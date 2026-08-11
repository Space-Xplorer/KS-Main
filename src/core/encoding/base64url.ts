/**
 * base64url (RFC 4648 §5), unpadded.
 *
 * Hand-rolled rather than using btoa/Buffer so core has no dependency on a
 * browser global or a Node builtin, and so the exact same bytes come out on
 * a volunteer's Android phone, an iPhone, and in CI.
 */

import type { Bytes } from "@/core/encoding/bytes";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Reverse lookup, built once. Index = char code, value = 6-bit value or -1. */
const LOOKUP = /* @__PURE__ */ (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function encodeBase64Url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;

  // Three input bytes become four output characters.
  for (; i + 2 < bytes.length; i += 3) {
    const triple = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      ALPHABET[(triple >>> 18) & 63]! +
      ALPHABET[(triple >>> 12) & 63]! +
      ALPHABET[(triple >>> 6) & 63]! +
      ALPHABET[triple & 63]!;
  }

  // Tail: one or two leftover bytes, emitted without "=" padding.
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i]! << 16;
    out += ALPHABET[(chunk >>> 18) & 63]! + ALPHABET[(chunk >>> 12) & 63]!;
  } else if (remaining === 2) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out +=
      ALPHABET[(chunk >>> 18) & 63]! +
      ALPHABET[(chunk >>> 12) & 63]! +
      ALPHABET[(chunk >>> 6) & 63]!;
  }

  return out;
}

/** Returns null on any character outside the alphabet, or an impossible length. */
export function decodeBase64Url(text: string): Bytes | null {
  // A length of 1 mod 4 cannot be produced by the encoder.
  if (text.length % 4 === 1) return null;

  const byteLength = Math.floor((text.length * 3) / 4);
  const out = new Uint8Array(byteLength);

  let accumulator = 0;
  let bitsHeld = 0;
  let written = 0;

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code]! : -1;
    if (value < 0) return null;

    accumulator = (accumulator << 6) | value;
    bitsHeld += 6;

    if (bitsHeld >= 8) {
      bitsHeld -= 8;
      out[written] = (accumulator >>> bitsHeld) & 0xff;
      written += 1;
    }
  }

  return written === byteLength ? out : out.subarray(0, written);
}
