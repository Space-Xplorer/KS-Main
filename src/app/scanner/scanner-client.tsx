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

/**
 * The real attendance scanner: registration desk + scan lane in one screen.
 *
 * Same layered code as the dev harness (src/app/dev/attendance/harness.tsx)
 * underneath — real signed tokens, real Dexie outbox, real SyncEngine, real
 * Supabase writes through apply_checkin(). What differs is the boundary:
 * this talks to /api/checkins/* (real per-user auth via requireStaff(), no
 * shared key, no client-supplied event id — the server resolves the current
 * event itself). See src/lib/require-staff.ts and
 * src/infra/supabase/current-event.ts.
 *
 * Single combined screen deliberately, for now: the system design calls for
 * splitting this into a dedicated walk-in desk and scanner route, but that is
 * more surface to build and test than the runway to this event allows. Revisit
 * post-event.
 */

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) {
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return body;
}

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

export function Scanner() {
  const db = getDB();
  const router = useRouter();

  const [signingOut, setSigningOut] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [provisioning, setProvisioning] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
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
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev.slice(0, 49)]);
  }, []);

  const refreshPending = useCallback(async () => {
    setPendingCount(await new DexieOutbox(db).pendingCount());
  }, [db]);

  /* eslint-disable react-hooks/set-state-in-effect --
   * Standard "load client-only state on mount" effect — see harness.tsx for
   * the same reasoning: IndexedDB/localStorage do not exist during SSR. */
  useEffect(() => {
    setDeviceId(getDeviceId());
    setCameraSupported("BarcodeDetector" in window);
    void registrationCount(db).then(setLocalCount);
    void refreshPending();
  }, [db, refreshPending]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleProvision() {
    setProvisioning(true);
    try {
      const data = await apiFetchJson<{
        eventId: string;
        signingSecret: string;
        registrations: readonly LocalRegSummary[];
      }>("/api/checkins/provision");

      keyRef.current = await createHmacKey(data.signingSecret);
      setEventId(data.eventId);
      await seedRegistrations(
        db,
        data.registrations.map((r) => ({
          registrationId: r.registrationId,
          eventId: data.eventId,
          displayName: r.displayName,
          checkedInAt: null,
        })),
      );

      setLocalCount(await registrationCount(db));
      appendLog(`Provisioned: pulled ${data.registrations.length} pass(es) and the event secret.`);
    } catch (error) {
      appendLog(`Provisioning failed: ${describeError(error)}`);
    } finally {
      setProvisioning(false);
    }
  }

  async function handleIssue() {
    if (name.trim().length === 0) return;
    setIssuing(true);
    setIssued(null);
    try {
      const data = await apiFetchJson<{
        registrationId: string;
        eventId: string;
        name: string;
        qrToken: string;
      }>("/api/checkins/issue", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), deviceId }),
      });

      const qrDataUrl = await QRCode.toDataURL(data.qrToken, { margin: 1, width: 240 });
      setIssued({ ...data, qrDataUrl });
      appendLog(`Issued a pass for "${data.name}" (${data.registrationId.slice(0, 8)}…).`);

      if (addToDevice) {
        await seedRegistrations(db, [
          {
            registrationId: data.registrationId,
            eventId: data.eventId,
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

  const handleScan = useCallback(
    async (token: string) => {
      const key = keyRef.current;
      const id = deviceId;
      const currentEventId = eventId;
      if (!key || !id || !currentEventId) {
        appendLog("Provision this device before scanning.");
        return;
      }
      if (token.trim().length === 0) return;

      setScanning(true);
      try {
        const decision = await checkIn(
          token.trim(),
          { eventId: currentEventId, deviceId: id },
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
    [db, deviceId, eventId, appendLog, refreshPending],
  );

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

  const provisioned = eventId !== null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="kicker">Celestra staff</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Attendance scanner
          </h1>
        </div>
        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="border-edge-bright text-haze hover:border-plasma hover:text-starlight shrink-0 border px-4 py-2 font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <p className="text-haze mt-3 text-[0.85rem] leading-relaxed">
        Device <span className="text-starlight font-mono">{deviceId ?? "…"}</span>
        {provisioned && (
          <>
            {" "}
            · Event <span className="text-starlight font-mono">{eventId}</span>
          </>
        )}{" "}
        · Local passes cached <span className="text-starlight tabular font-mono">{localCount}</span>
      </p>

      <Section number="1" title="Provision this device">
        <p className="text-haze text-[0.85rem] leading-relaxed">
          Pulls the event&rsquo;s signing secret and the current pass list. Do
          this on good network, then everything below works with none.
        </p>
        <button
          onClick={() => void handleProvision()}
          disabled={provisioning}
          className="bg-starlight text-void hover:bg-plasma mt-4 px-6 py-2.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
        >
          {provisioning ? "Provisioning…" : provisioned ? "Re-provision" : "Provision"}
        </button>
        {provisioned && <p className="text-verdant mt-3 text-sm">Provisioned ✓</p>}
      </Section>

      <Section number="2" title="Issue a walk-in pass">
        <p className="text-haze text-[0.85rem] leading-relaxed">
          Writes a registration and a signed token to Supabase, then renders
          it as a QR to screenshot on the spot.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Attendee name"
            className="border-edge bg-deep/40 text-starlight focus:border-plasma flex-1 border px-3 py-2.5 text-sm outline-none"
          />
          <button
            onClick={() => void handleIssue()}
            disabled={issuing || !provisioned}
            className="bg-starlight text-void hover:bg-plasma px-6 py-2.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
          >
            {issuing ? "Issuing…" : "Issue"}
          </button>
        </div>
        <label className="text-haze mt-3 flex items-center gap-2 text-[0.85rem]">
          <input
            type="checkbox"
            checked={addToDevice}
            onChange={(e) => setAddToDevice(e.target.checked)}
          />
          Add to this device&rsquo;s local cache immediately
        </label>
        {!provisioned && (
          <p className="text-signal mt-3 text-sm">Provision the device first.</p>
        )}

        {issued && (
          <div className="border-edge mt-4 flex items-start gap-4 border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a client-generated data: URL, not an optimisable asset */}
            <img src={issued.qrDataUrl} alt={`QR pass for ${issued.name}`} width={140} height={140} />
            <div className="min-w-0">
              <p className="text-starlight font-medium">{issued.name}</p>
              <p className="text-dust mt-1 font-mono text-xs break-all">{issued.qrToken}</p>
              <button
                onClick={() => setTokenInput(issued.qrToken)}
                className="text-plasma mt-2 text-xs underline"
              >
                Copy into the scan box below ↓
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section number="3" title="Scan">
        <p className="text-haze text-[0.85rem] leading-relaxed">
          Verifies locally, no network call. Paste a token, or scan with a
          camera where supported.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste a QR token"
            className="border-edge bg-deep/40 text-starlight focus:border-plasma flex-1 border px-3 py-2.5 font-mono text-xs outline-none"
          />
          <button
            onClick={() => void handleScan(tokenInput)}
            disabled={scanning || !provisioned}
            className="bg-starlight text-void hover:bg-plasma px-6 py-2.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
          >
            Verify
          </button>
        </div>

        {cameraSupported ? (
          <div className="mt-4">
            <button
              onClick={() => (cameraOn ? stopCamera() : void startCamera())}
              disabled={!provisioned}
              className="border-edge-bright text-haze hover:border-plasma hover:text-starlight border px-6 py-2.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
            >
              {cameraOn ? "Stop camera" : "Start camera"}
            </button>
            <video
              ref={videoRef}
              muted
              playsInline
              className={`border-edge mt-4 w-full max-w-xs border ${cameraOn ? "" : "hidden"}`}
            />
          </div>
        ) : (
          <p className="text-dust mt-4 text-xs">
            Camera scanning needs a Chromium-based browser (BarcodeDetector API).
            Paste works everywhere.
          </p>
        )}

        {lastResult && <ResultBanner result={lastResult} />}
      </Section>

      <Section number="4" title="Sync">
        <p className="text-haze text-[0.85rem] leading-relaxed">
          Pushes the local queue to Supabase. Idempotent, so it is safe to
          press repeatedly, and safe if the network drops mid-push.
        </p>
        <p className="text-haze mt-3 text-sm">
          Pending: <span className="text-starlight tabular font-mono">{pendingCount}</span>
        </p>
        <button
          onClick={() => void handleSync()}
          disabled={syncing}
          className="bg-starlight text-void hover:bg-plasma mt-4 px-6 py-2.5 font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        {lastSync && (
          <p className="text-dust tabular mt-3 font-mono text-xs">
            synced {lastSync.synced} · rejected {lastSync.rejected} · retrying{" "}
            {lastSync.retrying} · pending after {lastSync.pendingAfter}
          </p>
        )}
      </Section>

      <Section number="—" title="Log">
        <ul className="text-dust max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
          {log.length === 0 && <li className="text-dust/50">Nothing yet.</li>}
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-edge mt-10 border-t pt-8">
      <h2 className="flex items-baseline gap-2.5">
        <span className="text-plasma font-mono text-[0.75rem]">{number}</span>
        <span className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</span>
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ResultBanner({ result }: { result: CheckInDecision }) {
  if (result.status === "accepted") {
    return (
      <p className="border-verdant/40 bg-verdant/10 text-verdant mt-4 border p-3 text-sm">
        ✅ Checked in: {result.displayName ?? result.record.registrationId}
      </p>
    );
  }
  if (result.status === "duplicate") {
    return (
      <p className="border-signal/40 bg-signal/10 text-signal mt-4 border p-3 text-sm">
        ⚠️ Already checked in: {result.displayName ?? result.record.registrationId} at{" "}
        {new Date(result.firstSeenAt).toLocaleTimeString()}
      </p>
    );
  }
  return (
    <p className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      ❌ {REJECTION_MESSAGE[result.reason] ?? result.reason}
    </p>
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
