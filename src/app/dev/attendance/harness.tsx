"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import type { CheckInDecision } from "@/core/attendance/check-in";
import { checkIn } from "@/core/attendance/check-in";
import { TOKEN_ERROR_MESSAGE } from "@/core/tokens/payload";
import { SyncEngine, type SyncReport } from "@/core/sync/engine";
import { createHmacKey, type HmacKey } from "@/infra/crypto/hmac-signer";
import { getDB } from "@/infra/dexie/db";
import { DexieOutbox } from "@/infra/dexie/outbox";
import {
  findRegistration,
  registrationCount,
  seedRegistrations,
} from "@/infra/dexie/registrations";
import { getDeviceId } from "@/infra/device/device-id";
import { cryptoIdGenerator } from "@/infra/ids/uuid-generator";
import { systemClock } from "@/infra/time/system-clock";
import { CheckinPusher } from "@/infra/sync/checkin-pusher";
import { createClient } from "@/infra/supabase/browser";

import { devFetchJson } from "./dev-client";

/**
 * Dev harness for the offline attendance pipeline.
 *
 * This is a test tool, not the polished walk-in desk or scanner UI. It
 * exercises the ACTUAL layered code end to end: real signed tokens, real
 * Dexie outbox, real SyncEngine, real Supabase writes through the
 * apply_checkin() trigger. Nothing here is mocked. What is missing is the
 * provisioning runbook and visual polish — later work.
 *
 * Reaching this component now requires BOTH of two independent gates,
 * deliberately not merged into one:
 *   1. src/app/dev/attendance/page.tsx (server component) — real per-user
 *      auth: signed in AND has a staff role (public.is_staff()). This is who
 *      may open the page at all.
 *   2. src/lib/dev-guard.ts, fronting /api/dev/* — a shared static key. This
 *      stays as a second lock on the API routes themselves, independent of
 *      whoever is signed in, because it also guards the "hand out the event's
 *      signing secret" endpoint. See that file for why it is a flag, not
 *      NODE_ENV.
 */

// Matches supabase/seed.sql. Swap for a real event picker once one exists.
const DEV_EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

interface LocalRegSummary {
  readonly registrationId: string;
  readonly displayName: string | null;
}

const REJECTION_MESSAGE: Record<string, string> = {
  ...TOKEN_ERROR_MESSAGE,
  wrong_event: "This pass is for a different event.",
  unknown_registration:
    "Authentic pass, but this device has not seen it yet. Not a forgery. " +
    "Usually means it was issued elsewhere and has not synced to this device.",
};

export function Harness() {
  const db = getDB();
  const router = useRouter();

  const [signingOut, setSigningOut] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const keyRef = useRef<HmacKey | null>(null);

  const [name, setName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [addToDevice, setAddToDevice] = useState(true);
  const [issued, setIssued] = useState<{
    registrationId: string;
    name: string;
    qrToken: string;
    qrDataUrl: string;
  } | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<CheckInDecision | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncReport | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopCameraLoopRef = useRef(false);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [
      `${new Date().toLocaleTimeString()}  ${line}`,
      ...prev.slice(0, 49),
    ]);
  }, []);

  const refreshPending = useCallback(async () => {
    setPendingCount(await new DexieOutbox(db).pendingCount());
  }, [db]);

  /* eslint-disable react-hooks/set-state-in-effect --
   * This is the standard "load client-only state on mount" effect React's own
   * docs describe (https://react.dev/learn/you-might-not-need-an-effect) —
   * localStorage and IndexedDB do not exist during this client component's
   * server render, so deviceId/cameraSupported/localCount/pendingCount can
   * only be read once mounted in the browser. The rule flags every setState
   * reachable from an effect, including through a called function, which has
   * no alternative shape for a one-time initial-load effect like this one. */
  useEffect(() => {
    setDeviceId(getDeviceId());
    setCameraSupported("BarcodeDetector" in window);
    void registrationCount(db).then(setLocalCount);
    void refreshPending();
  }, [db, refreshPending]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- Sign out ----------------------------------------------------------

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // --- Provisioning ----------------------------------------------------

  async function handleProvision() {
    setProvisioning(true);
    try {
      const data = await devFetchJson<{
        signingSecret: string;
        registrations: readonly LocalRegSummary[];
      }>(`/api/dev/provision?eventId=${DEV_EVENT_ID}`);

      keyRef.current = await createHmacKey(data.signingSecret);
      await seedRegistrations(
        db,
        data.registrations.map((r) => ({
          registrationId: r.registrationId,
          eventId: DEV_EVENT_ID,
          displayName: r.displayName,
          checkedInAt: null,
        })),
      );

      setProvisioned(true);
      setLocalCount(await registrationCount(db));
      appendLog(`Provisioned: pulled ${data.registrations.length} pass(es) and the event secret.`);
    } catch (error) {
      appendLog(`Provisioning failed: ${describeError(error)}`);
    } finally {
      setProvisioning(false);
    }
  }

  // --- Issuing -----------------------------------------------------------

  async function handleIssue() {
    if (name.trim().length === 0) return;
    setIssuing(true);
    setIssued(null);
    try {
      const data = await devFetchJson<{
        registrationId: string;
        name: string;
        qrToken: string;
      }>("/api/dev/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: DEV_EVENT_ID, name: name.trim() }),
      });

      const qrDataUrl = await QRCode.toDataURL(data.qrToken, { margin: 1, width: 240 });
      setIssued({ ...data, qrDataUrl });
      appendLog(`Issued a pass for "${data.name}" (${data.registrationId.slice(0, 8)}…).`);

      if (addToDevice) {
        await seedRegistrations(db, [
          {
            registrationId: data.registrationId,
            eventId: DEV_EVENT_ID,
            displayName: data.name,
            checkedInAt: null,
          },
        ]);
        setLocalCount(await registrationCount(db));
        appendLog("Added to this device's local cache immediately.");
      } else {
        appendLog(
          "NOT added locally. Scanning it now should show “unknown registration”, " +
            "not a forgery. Re-provision to pull it in.",
        );
      }
    } catch (error) {
      appendLog(`Issue failed: ${describeError(error)}`);
    } finally {
      setIssuing(false);
    }
  }

  // --- Scanning ------------------------------------------------------------

  const handleScan = useCallback(
    async (token: string) => {
      const key = keyRef.current;
      const id = deviceId;
      if (!key || !id) {
        appendLog("Provision this device before scanning.");
        return;
      }
      if (token.trim().length === 0) return;

      setScanning(true);
      try {
        const decision = await checkIn(
          token.trim(),
          { eventId: DEV_EVENT_ID, deviceId: id },
          {
            verifier: key,
            clock: systemClock,
            ids: cryptoIdGenerator,
            findRegistration: (registrationId) => findRegistration(db, registrationId),
          },
        );

        setLastResult(decision);

        if (decision.status === "accepted" || decision.status === "duplicate") {
          const outbox = new DexieOutbox(db);
          await outbox.enqueue(
            {
              id: decision.record.id,
              kind: "checkin",
              payload: {
                registrationId: decision.record.registrationId,
                deviceId: decision.record.deviceId,
                scannedAt: decision.record.scannedAt,
              },
            },
            systemClock.now(),
          );

          if (decision.status === "accepted") {
            const { markCheckedInLocally } = await import("@/infra/dexie/registrations");
            await markCheckedInLocally(db, decision.record.registrationId, decision.record.scannedAt);
            appendLog(`Accepted: ${decision.displayName ?? decision.record.registrationId}.`);
          } else {
            appendLog(
              `Duplicate: ${decision.displayName ?? decision.record.registrationId} ` +
                `(first seen ${new Date(decision.firstSeenAt).toLocaleTimeString()}).`,
            );
          }
          await refreshPending();
        } else {
          appendLog(`Rejected: ${REJECTION_MESSAGE[decision.reason] ?? decision.reason}`);
        }
      } catch (error) {
        appendLog(`Scan error: ${describeError(error)}`);
      } finally {
        setScanning(false);
      }
    },
    [db, deviceId, appendLog, refreshPending],
  );

  // --- Camera ----------------------------------------------------------

  async function startCamera() {
    if (!window.BarcodeDetector) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      stopCameraLoopRef.current = false;

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopCameraLoopRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            stopCamera();
            await handleScan(codes[0]!.rawValue);
            return;
          }
        } catch {
          // A frame the detector could not read. Just try the next one.
        }
        requestAnimationFrame(() => void tick());
      };
      requestAnimationFrame(() => void tick());
    } catch (error) {
      appendLog(`Camera unavailable: ${describeError(error)}`);
    }
  }

  function stopCamera() {
    stopCameraLoopRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => () => stopCamera(), []);

  // --- Sync ------------------------------------------------------------

  async function handleSync() {
    setSyncing(true);
    try {
      const engine = new SyncEngine(new DexieOutbox(db), new CheckinPusher(), systemClock);
      const report = await engine.drainAll();
      setLastSync(report);
      appendLog(
        `Sync: ${report.synced} synced, ${report.rejected} rejected, ` +
          `${report.retrying} still queued, ${report.pendingAfter} pending.`,
      );
    } catch (error) {
      appendLog(`Sync error: ${describeError(error)}`);
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-amber-400 uppercase">
            Dev harness. Not the real scanner UI
          </p>
          <h1 className="mt-2 text-3xl font-bold">Attendance pipeline test</h1>
        </div>
        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="shrink-0 rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:text-white disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <p className="mt-2 text-sm text-white/60">
        Device: <span className="font-mono">{deviceId ?? "…"}</span> · Event:{" "}
        <span className="font-mono">{DEV_EVENT_ID}</span> · Local passes cached:{" "}
        {localCount}
      </p>

      {/* 1. Provision */}
      <Section title="1. Provision this device">
        <p className="text-sm text-white/70">
          Pulls the event&rsquo;s signing secret and the current pass list, the
          way a scanner does before doors open. Do this on good network, then
          everything below works with none.
        </p>
        <button
          onClick={() => void handleProvision()}
          disabled={provisioning}
          className="mt-3 rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {provisioning ? "Provisioning…" : provisioned ? "Re-provision" : "Provision"}
        </button>
        {provisioned && (
          <p className="mt-2 text-sm text-emerald-400">Provisioned ✓</p>
        )}
      </Section>

      {/* 2. Issue */}
      <Section title="2. Issue a pass">
        <p className="text-sm text-white/70">
          Stands in for online pre-registration / the walk-in desk. Writes a
          registration and a signed token to Supabase, then renders it as a QR.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Attendee name"
            className="flex-1 rounded border border-white/20 bg-black px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleIssue()}
            disabled={issuing || !provisioned}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {issuing ? "Issuing…" : "Issue"}
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={addToDevice}
            onChange={(e) => setAddToDevice(e.target.checked)}
          />
          Add to this device&rsquo;s local cache immediately
        </label>
        {!provisioned && (
          <p className="mt-2 text-sm text-amber-400">Provision the device first.</p>
        )}

        {issued && (
          <div className="mt-4 flex items-start gap-4 rounded border border-white/10 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a client-generated data: URL, not an optimisable asset */}
            <img src={issued.qrDataUrl} alt={`QR pass for ${issued.name}`} width={140} height={140} />
            <div className="min-w-0">
              <p className="font-medium">{issued.name}</p>
              <p className="mt-1 font-mono text-xs break-all text-white/50">
                {issued.qrToken}
              </p>
              <button
                onClick={() => setTokenInput(issued.qrToken)}
                className="mt-2 text-xs text-sky-400 underline"
              >
                Copy into the scan box below ↓
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* 3. Scan */}
      <Section title="3. Scan">
        <p className="text-sm text-white/70">
          Verifies locally, no network call. Paste a token, or scan with a
          camera where supported.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste a QR token"
            className="flex-1 rounded border border-white/20 bg-black px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={() => void handleScan(tokenInput)}
            disabled={scanning || !provisioned}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            Verify
          </button>
        </div>

        {cameraSupported ? (
          <div className="mt-3">
            <button
              onClick={() => (cameraOn ? stopCamera() : void startCamera())}
              disabled={!provisioned}
              className="rounded border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
            >
              {cameraOn ? "Stop camera" : "Start camera"}
            </button>
            <video
              ref={videoRef}
              muted
              playsInline
              className={`mt-3 w-full max-w-xs rounded border border-white/10 ${cameraOn ? "" : "hidden"}`}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/40">
            Camera scanning needs a Chromium-based browser (BarcodeDetector API).
            Paste works everywhere.
          </p>
        )}

        {lastResult && <ResultBanner result={lastResult} />}
      </Section>

      {/* 4. Sync */}
      <Section title="4. Sync">
        <p className="text-sm text-white/70">
          Pushes the local queue to Supabase. Idempotent, so it is safe to press
          repeatedly, and safe if the network drops mid-push.
        </p>
        <p className="mt-2 text-sm">
          Pending: <span className="font-mono">{pendingCount}</span>
        </p>
        <button
          onClick={() => void handleSync()}
          disabled={syncing}
          className="mt-3 rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        {lastSync && (
          <p className="mt-2 font-mono text-xs text-white/60">
            synced {lastSync.synced} · rejected {lastSync.rejected} · retrying{" "}
            {lastSync.retrying} · pending after {lastSync.pendingAfter}
          </p>
        )}
      </Section>

      {/* Log */}
      <Section title="Log">
        <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-white/60">
          {log.length === 0 && <li className="text-white/30">Nothing yet.</li>}
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-white/10 pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ResultBanner({ result }: { result: CheckInDecision }) {
  if (result.status === "accepted") {
    return (
      <p className="mt-4 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
        ✅ Checked in: {result.displayName ?? result.record.registrationId}
      </p>
    );
  }
  if (result.status === "duplicate") {
    return (
      <p className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
        ⚠️ Already checked in: {result.displayName ?? result.record.registrationId} at{" "}
        {new Date(result.firstSeenAt).toLocaleTimeString()}
      </p>
    );
  }
  return (
    <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      ❌ {REJECTION_MESSAGE[result.reason] ?? result.reason}
    </p>
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
