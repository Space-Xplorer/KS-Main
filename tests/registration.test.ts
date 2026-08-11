import { describe, expect, it } from "vitest";

import { createWalkinRegistration } from "@/core/registration/create-walkin";
import { verifyToken } from "@/core/tokens/verify";
import { createHmacKey } from "@/infra/crypto/hmac-signer";
import { FakeClock, SeqIdGenerator } from "@/infra/testing/fakes";

const EVENT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

async function deps(start = 1_754_700_000_000) {
  const signer = await createHmacKey("event-secret");
  return {
    signer,
    clock: new FakeClock(start),
    ids: new SeqIdGenerator(),
  };
}

const input = {
  eventId: EVENT,
  deviceId: "desk-1",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
};

describe("createWalkinRegistration", () => {
  it("issues a pass the scanner will accept, with no server involved", async () => {
    const d = await deps();

    const result = await createWalkinRegistration(input, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const verified = await verifyToken(result.registration.qrToken, d.signer);
    expect(verified.ok).toBe(true);
    expect(verified.ok && verified.payload.registrationId).toBe(
      result.registration.registrationId,
    );
    expect(verified.ok && verified.payload.issuedBy).toBe("desk-1");
  });

  it("generates the id on the device so two desks cannot collide", async () => {
    // Separate generators stand in for two physically separate desks.
    const deskA = await createWalkinRegistration(input, await deps());
    const deskB = await createWalkinRegistration(
      { ...input, deviceId: "desk-2" },
      { ...(await deps()), ids: new SeqIdGenerator("11111111-0000-4000-8000-") },
    );

    expect(deskA.ok && deskB.ok).toBe(true);
    expect(deskA.ok && deskA.registration.registrationId).not.toBe(
      deskB.ok && deskB.registration.registrationId,
    );
  });

  it("records the walk-in source and issuing device for reconciliation", async () => {
    const result = await createWalkinRegistration(input, await deps());

    expect(result.ok && result.registration.source).toBe("walkin");
    expect(result.ok && result.registration.issuedByDeviceId).toBe("desk-1");
  });

  it("puts seconds in the token but keeps milliseconds on the record", async () => {
    const result = await createWalkinRegistration(input, await deps(1_754_700_123_456));

    expect(result.ok && result.registration.createdAt).toBe(1_754_700_123_456);

    const verified = await verifyToken(
      result.ok ? result.registration.qrToken : "",
      (await deps()).signer,
    );
    expect(verified.ok && verified.payload.issuedAt).toBe(1_754_700_123);
  });

  it("requires a name, because the volunteer has to read it back", async () => {
    const result = await createWalkinRegistration({ ...input, name: "   " }, await deps());
    expect(result).toEqual({ ok: false, reason: "name_required" });
  });

  it("trims whitespace rather than rejecting it", async () => {
    const result = await createWalkinRegistration(
      { ...input, name: "  Asha Rao  " },
      await deps(),
    );
    expect(result.ok && result.registration.name).toBe("Asha Rao");
  });

  it("accepts a walk-in with no contact details at all", async () => {
    // A queue is forming; missing an email must never block entry.
    const result = await createWalkinRegistration(
      { ...input, email: null, phone: "" },
      await deps(),
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.registration.email).toBeNull();
    expect(result.ok && result.registration.phone).toBeNull();
  });

  it("catches an obviously mistyped email", async () => {
    const result = await createWalkinRegistration(
      { ...input, email: "asha.example.com" },
      await deps(),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("fails cleanly on a malformed event id instead of issuing a bad pass", async () => {
    const result = await createWalkinRegistration(
      { ...input, eventId: "not-a-uuid" },
      await deps(),
    );
    expect(result).toEqual({ ok: false, reason: "token_generation_failed" });
  });
});
