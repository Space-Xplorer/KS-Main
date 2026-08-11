import { describe, expect, it } from "vitest";

import { QR_TOKEN_VERSION, type QrTokenPayload } from "@/core/tokens/payload";
import { decodePayload, encodePayload } from "@/core/tokens/codec";
import { signToken } from "@/core/tokens/sign";
import { verifyToken } from "@/core/tokens/verify";
import { createHmacKey } from "@/infra/crypto/hmac-signer";

const EVENT_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EVENT_B = "9c858901-8a57-4791-81fe-4c455b099bc9";
const REGISTRATION = "550e8400-e29b-41d4-a716-446655440000";

function payload(overrides: Partial<QrTokenPayload> = {}): QrTokenPayload {
  return {
    version: QR_TOKEN_VERSION,
    eventId: EVENT_A,
    registrationId: REGISTRATION,
    issuedBy: "lane-1",
    issuedAt: 1_754_700_000,
    ...overrides,
  };
}

describe("token codec", () => {
  it("round-trips a payload exactly", () => {
    const encoded = encodePayload(payload());
    expect(encoded).not.toBeNull();
    expect(decodePayload(encoded!)).toEqual(payload());
  });

  it("keeps the QR short enough to scan on a cheap camera", async () => {
    const key = await createHmacKey("secret");
    const token = await signToken(payload(), key);
    // Compact UUIDs are the point of the encoding; guard against regressing
    // to hex, which would push the QR into a denser, harder-to-scan version.
    expect(token!.length).toBeLessThan(120);
  });

  it("survives an issuer containing the field separator", () => {
    const encoded = encodePayload(payload({ issuedBy: "lane.1.desk" }));
    expect(decodePayload(encoded!)?.issuedBy).toBe("lane.1.desk");
  });

  it("rejects a non-UUID event id rather than encoding nonsense", () => {
    expect(encodePayload(payload({ eventId: "not-a-uuid" }))).toBeNull();
  });

  it.each([
    ["leading zero", "01"],
    ["uppercase digit", "1Z"],
    ["trailing punctuation", "1!"],
    ["empty field", ""],
  ])("rejects a non-canonical numeric field: %s", (_label, version) => {
    // Only the exact output of toString(36) may parse. Anything a lenient
    // parseInt would accept must be refused, or two different strings could
    // decode to the same payload while carrying different signatures.
    const parts = encodePayload(payload())!.split(".");
    parts[0] = version;
    expect(decodePayload(parts.join("."))).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["too few fields", "1.a.b"],
    ["not base64url", "1.!!!.###.$$$.1"],
  ])("rejects malformed input: %s", (_label, input) => {
    expect(decodePayload(input)).toBeNull();
  });
});

describe("token signing and verification", () => {
  it("accepts a token signed with the same event secret", async () => {
    const key = await createHmacKey("event-a-secret");
    const token = await signToken(payload(), key);

    const result = await verifyToken(token!, key);

    expect(result.ok).toBe(true);
    expect(result.ok && result.payload).toEqual(payload());
  });

  it("rejects a token whose payload was tampered with", async () => {
    const key = await createHmacKey("event-a-secret");
    const token = await signToken(payload(), key);

    // Flip one character of the registration-id field, leaving it well-formed.
    const parts = token!.split(".");
    const field = parts[2]!;
    parts[2] = (field[0] === "A" ? "B" : "A") + field.slice(1);

    const result = await verifyToken(parts.join("."), key);

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token whose signature was tampered with", async () => {
    const key = await createHmacKey("event-a-secret");
    const token = await signToken(payload(), key);

    const parts = token!.split(".");
    const signature = parts[5]!;
    parts[5] = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    const result = await verifyToken(parts.join("."), key);

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects last year's pass: a token signed with a different event secret", async () => {
    const eventA = await createHmacKey("event-a-secret");
    const eventB = await createHmacKey("event-b-secret");

    const token = await signToken(payload({ eventId: EVENT_B }), eventB);
    const result = await verifyToken(token!, eventA);

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token from a newer app version, but only once it is authentic", async () => {
    const key = await createHmacKey("event-a-secret");
    const token = await signToken(payload({ version: QR_TOKEN_VERSION + 1 }), key);

    const result = await verifyToken(token!, key);

    expect(result).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("reports a forged token as unauthentic rather than out of date", async () => {
    const key = await createHmacKey("event-a-secret");
    const other = await createHmacKey("attacker-secret");
    // Signed by the wrong key AND a future version: authenticity must win,
    // otherwise the gate UI tells a volunteer to go update the app.
    const token = await signToken(payload({ version: 99 }), other);

    const result = await verifyToken(token!, key);

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it.each([
    ["no signature field", "1.a.b.c.d"],
    ["empty signature", "1.a.b.c.d."],
    ["no separators at all", "garbage"],
  ])("treats %s as malformed", async (_label, token) => {
    const key = await createHmacKey("event-a-secret");
    const result = await verifyToken(token, key);
    expect(result.ok).toBe(false);
  });

  it("refuses to build a key from an empty secret", async () => {
    await expect(createHmacKey("")).rejects.toThrow(/empty secret/i);
  });
});
