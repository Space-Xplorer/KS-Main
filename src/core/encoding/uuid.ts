/**
 * UUID <-> raw 16 bytes.
 *
 * Why this exists: a QR token carries two UUIDs. In canonical hex form that is
 * 72 characters; as raw bytes in base64url it is 44. Fewer characters means a
 * lower-density QR, which matters when the scanner is a mid-range phone camera
 * under bad venue lighting with a queue building behind it.
 */

import type { Bytes } from "@/core/encoding/bytes";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEX = "0123456789abcdef";

/** Returns null if the string is not a canonical 8-4-4-4-12 UUID. */
export function uuidToBytes(uuid: string): Bytes | null {
  if (!UUID_PATTERN.test(uuid)) return null;

  const hex = uuid.replaceAll("-", "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Returns null unless given exactly 16 bytes. */
export function bytesToUuid(bytes: Uint8Array): string | null {
  if (bytes.length !== 16) return null;

  let hex = "";
  for (let i = 0; i < 16; i += 1) {
    const byte = bytes[i]!;
    hex += HEX[byte >>> 4]! + HEX[byte & 0x0f]!;
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
