import { describe, expect, it } from "vitest";

import { decodeBase64Url, encodeBase64Url } from "@/core/encoding/base64url";
import { bytesToUuid, isUuid, uuidToBytes } from "@/core/encoding/uuid";
import { utf8Decode, utf8Encode } from "@/core/encoding/utf8";

describe("base64url", () => {
  it.each([0, 1, 2, 3, 4, 5, 15, 16, 17, 32, 255])(
    "round-trips %i bytes",
    (length) => {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37) % 256);
      const decoded = decodeBase64Url(encodeBase64Url(bytes));
      expect(decoded).not.toBeNull();
      expect([...decoded!]).toEqual([...bytes]);
    },
  );

  it("emits no padding and no URL-unsafe characters", () => {
    const bytes = Uint8Array.from({ length: 64 }, (_, i) => i * 4);
    const encoded = encodeBase64Url(bytes);
    expect(encoded).not.toMatch(/[=+/]/);
  });

  it("encodes a 16-byte UUID to 22 characters", () => {
    // The whole reason for this encoding: 22 chars instead of 36 in the QR.
    expect(encodeBase64Url(new Uint8Array(16))).toHaveLength(22);
  });

  it.each([
    ["standard base64 padding", "AAAA="],
    ["standard base64 alphabet", "a+b/c"],
    ["impossible length", "A"],
    ["unicode", "日本語"],
  ])("rejects %s", (_label, input) => {
    expect(decodeBase64Url(input)).toBeNull();
  });

  it("preserves high bytes exactly", () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x80, 0x7f]);
    expect([...decodeBase64Url(encodeBase64Url(bytes))!]).toEqual([...bytes]);
  });
});

describe("uuid", () => {
  const UUID = "550e8400-e29b-41d4-a716-446655440000";

  it("round-trips through raw bytes", () => {
    const bytes = uuidToBytes(UUID);
    expect(bytes).toHaveLength(16);
    expect(bytesToUuid(bytes!)).toBe(UUID);
  });

  it("normalises uppercase input to lowercase", () => {
    expect(bytesToUuid(uuidToBytes(UUID.toUpperCase())!)).toBe(UUID);
  });

  it.each([
    ["no dashes", "550e8400e29b41d4a716446655440000"],
    ["too short", "550e8400-e29b-41d4-a716-4466554400"],
    ["non-hex", "550e8400-e29b-41d4-a716-44665544zzzz"],
    ["empty", ""],
  ])("rejects %s", (_label, input) => {
    expect(uuidToBytes(input)).toBeNull();
    expect(isUuid(input)).toBe(false);
  });

  it("rejects the wrong number of bytes", () => {
    expect(bytesToUuid(new Uint8Array(15))).toBeNull();
    expect(bytesToUuid(new Uint8Array(17))).toBeNull();
  });
});

describe("utf8", () => {
  it.each(["lane-1", "Kakṣyā Śāstra", "名前", "emoji 🎉", ""])(
    "round-trips %j",
    (text) => {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    },
  );

  it("rejects malformed bytes instead of silently substituting", () => {
    // A lone continuation byte. Returning U+FFFD here would let a corrupted
    // device id verify as if it were intact.
    expect(utf8Decode(new Uint8Array([0x80]))).toBeNull();
  });
});
