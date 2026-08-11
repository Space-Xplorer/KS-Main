/**
 * UTF-8 helpers.
 *
 * TextEncoder/TextDecoder are standard globals in both browsers and Node, so
 * using them keeps core free of imports while staying deterministic.
 */

import type { Bytes } from "@/core/encoding/bytes";

const encoder = new TextEncoder();

/** Strict: rejects malformed UTF-8 rather than silently inserting U+FFFD. */
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

export function utf8Encode(text: string): Bytes {
  return encoder.encode(text);
}

/** Returns null if the bytes are not valid UTF-8. */
export function utf8Decode(bytes: Uint8Array): string | null {
  try {
    return strictDecoder.decode(bytes);
  } catch {
    return null;
  }
}
