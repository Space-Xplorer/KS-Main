import { describe, expect, it } from "vitest";

import {
  checkIn,
  decideCheckIn,
  type LocalRegistration,
  type ScanContext,
} from "@/core/attendance/check-in";
import { resolveConflicts, type ScanRow } from "@/core/attendance/resolve-conflicts";
import { QR_TOKEN_VERSION } from "@/core/tokens/payload";
import { signToken } from "@/core/tokens/sign";
import { createHmacKey } from "@/infra/crypto/hmac-signer";
import { FakeClock, SeqIdGenerator } from "@/infra/testing/fakes";

const EVENT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER_EVENT = "9c858901-8a57-4791-81fe-4c455b099bc9";
const REGISTRATION = "550e8400-e29b-41d4-a716-446655440000";

const CONTEXT: ScanContext = { eventId: EVENT, deviceId: "lane-1" };

function registration(overrides: Partial<LocalRegistration> = {}): LocalRegistration {
  return {
    registrationId: REGISTRATION,
    eventId: EVENT,
    displayName: "Asha",
    checkedInAt: null,
    ...overrides,
  };
}

describe("decideCheckIn", () => {
  it("accepts a first scan and records the audit row", () => {
    const decision = decideCheckIn(registration(), CONTEXT, {
      scannedAt: 1_000,
      checkinId: "checkin-1",
    });

    expect(decision.status).toBe("accepted");
    expect(decision.status === "accepted" && decision.record).toEqual({
      id: "checkin-1",
      registrationId: REGISTRATION,
      deviceId: "lane-1",
      scannedAt: 1_000,
      isDuplicate: false,
    });
  });

  it("flags a second scan as duplicate but still records it", () => {
    const decision = decideCheckIn(
      registration({ checkedInAt: 900 }),
      CONTEXT,
      { scannedAt: 1_000, checkinId: "checkin-2" },
    );

    expect(decision.status).toBe("duplicate");
    // The row is written, not dropped — doc §4.5 wants the audit trail.
    expect(decision.status === "duplicate" && decision.record.isDuplicate).toBe(true);
    expect(decision.status === "duplicate" && decision.firstSeenAt).toBe(900);
  });

  it("treats a check-in at epoch 0 as a real check-in", () => {
    // Guards against a truthiness check replacing the explicit null test.
    const decision = decideCheckIn(registration({ checkedInAt: 0 }), CONTEXT, {
      scannedAt: 1_000,
      checkinId: "checkin-3",
    });

    expect(decision.status).toBe("duplicate");
  });
});

describe("checkIn end to end", () => {
  async function scannerFor(
    secret: string,
    known: LocalRegistration | null = registration(),
  ) {
    const key = await createHmacKey(secret);
    return {
      key,
      deps: {
        verifier: key,
        clock: new FakeClock(5_000),
        ids: new SeqIdGenerator(),
        findRegistration: async () => known,
      },
    };
  }

  async function passFor(key: Awaited<ReturnType<typeof createHmacKey>>, eventId = EVENT) {
    return (await signToken(
      {
        version: QR_TOKEN_VERSION,
        eventId,
        registrationId: REGISTRATION,
        issuedBy: "online",
        issuedAt: 1_754_700_000,
      },
      key,
    ))!;
  }

  it("accepts a genuine pass with no network available", async () => {
    const { key, deps } = await scannerFor("event-secret");
    const decision = await checkIn(await passFor(key), CONTEXT, deps);

    expect(decision.status).toBe("accepted");
    expect(decision.status === "accepted" && decision.displayName).toBe("Asha");
  });

  it("rejects a forged pass", async () => {
    const { deps } = await scannerFor("event-secret");
    const attacker = await createHmacKey("guessed-secret");

    const decision = await checkIn(await passFor(attacker), CONTEXT, deps);

    expect(decision).toEqual({ status: "rejected", reason: "bad_signature" });
  });

  it("rejects a pass for a different event", async () => {
    const { key, deps } = await scannerFor("event-secret");
    // Same secret, wrong event id: the event check must catch what the
    // signature cannot, in case a secret is ever reused across events.
    const decision = await checkIn(await passFor(key, OTHER_EVENT), CONTEXT, deps);

    expect(decision).toEqual({ status: "rejected", reason: "wrong_event" });
  });

  it("distinguishes an unknown registration from a forgery", async () => {
    const { key, deps } = await scannerFor("event-secret", null);

    const decision = await checkIn(await passFor(key), CONTEXT, deps);

    // Authentic pass this lane simply has not synced yet. Reporting this as
    // a forgery would have volunteers turning away real attendees.
    expect(decision).toEqual({ status: "rejected", reason: "unknown_registration" });
  });
});

describe("resolveConflicts", () => {
  const scan = (id: string, at: number, device = "lane-1"): ScanRow => ({
    id,
    registrationId: REGISTRATION,
    deviceId: device,
    scannedAt: at,
  });

  it("lets the earliest scan win across two lanes", () => {
    const result = resolveConflicts([
      scan("b", 2_000, "lane-2"),
      scan("a", 1_000, "lane-1"),
    ]);

    expect(result.checkedInAt.get(REGISTRATION)).toBe(1_000);
    expect(result.scans.find((s) => s.id === "a")?.isDuplicate).toBe(false);
    expect(result.scans.find((s) => s.id === "b")?.isDuplicate).toBe(true);
    expect(result.duplicateCount).toBe(1);
  });

  it("produces the same answer regardless of the order rows synced in", () => {
    const rows = [
      scan("a", 1_000, "lane-1"),
      scan("b", 2_000, "lane-2"),
      scan("c", 3_000, "lane-3"),
    ];

    const forward = resolveConflicts(rows);
    const reversed = resolveConflicts([...rows].reverse());

    expect(reversed.scans).toEqual(forward.scans);
    expect(reversed.checkedInAt).toEqual(forward.checkedInAt);
  });

  it("breaks an exact timestamp tie deterministically", () => {
    // Two lanes with synchronised clocks really can hit the same millisecond.
    const a = resolveConflicts([scan("z", 1_000, "lane-1"), scan("a", 1_000, "lane-2")]);
    const b = resolveConflicts([scan("a", 1_000, "lane-2"), scan("z", 1_000, "lane-1")]);

    expect(a.scans).toEqual(b.scans);
    expect(a.scans.find((s) => s.id === "a")?.isDuplicate).toBe(false);
  });

  it("separates a volunteer double-tap from a genuine cross-lane conflict", () => {
    const sameDevice = resolveConflicts([
      scan("a", 1_000, "lane-1"),
      scan("b", 1_100, "lane-1"),
    ]);
    const twoDevices = resolveConflicts([
      scan("a", 1_000, "lane-1"),
      scan("b", 1_100, "lane-2"),
    ]);

    expect(sameDevice.contestedRegistrationIds).toEqual([]);
    expect(twoDevices.contestedRegistrationIds).toEqual([REGISTRATION]);
  });

  it("handles independent registrations without cross-talk", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    const result = resolveConflicts([
      scan("a", 1_000),
      { id: "b", registrationId: other, deviceId: "lane-2", scannedAt: 500 },
    ]);

    expect(result.checkedInAt.get(REGISTRATION)).toBe(1_000);
    expect(result.checkedInAt.get(other)).toBe(500);
    expect(result.duplicateCount).toBe(0);
  });

  it("returns an empty result for no scans", () => {
    const result = resolveConflicts([]);
    expect(result.scans).toEqual([]);
    expect(result.duplicateCount).toBe(0);
  });
});
