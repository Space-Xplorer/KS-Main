import type { Bytes } from "@/core/encoding/bytes";
import { utf8Encode } from "@/core/encoding/utf8";
import type { TokenSigner, TokenVerifier } from "@/core/ports";

/**
 * HMAC-SHA256 over WebCrypto — the real implementation of the token ports.
 *
 * Works unchanged in the browser (secure context) and in Node, which matters:
 * the same key material signs a QR in a server route and verifies it on a
 * volunteer's phone with no signal.
 */

export type HmacKey = TokenSigner & TokenVerifier;

/**
 * @param secret The event's signing secret, distributed during provisioning
 *   (design doc §4.4). Rotate per event — never reuse across events or years.
 */
export async function createHmacKey(secret: string): Promise<HmacKey> {
  if (secret.length === 0) {
    throw new Error("Refusing to build a signing key from an empty secret");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    utf8Encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, // non-extractable: the secret cannot be read back out of the key
    ["sign", "verify"],
  );

  return {
    async sign(bytes: Bytes): Promise<Bytes> {
      const signature = await crypto.subtle.sign("HMAC", key, bytes);
      return new Uint8Array(signature);
    },

    /**
     * Uses crypto.subtle.verify rather than comparing bytes by hand — it
     * compares in constant time, so a scan cannot leak signature bytes through
     * how long it takes to reject.
     */
    async verify(bytes: Bytes, signature: Bytes): Promise<boolean> {
      return crypto.subtle.verify("HMAC", key, signature, bytes);
    },
  };
}
