import { decodeBase64Url } from "@/core/encoding/base64url";
import type { Bytes } from "@/core/encoding/bytes";
import { utf8Encode } from "@/core/encoding/utf8";
import type { TokenVerifier } from "@/core/ports";
import { decodePayload } from "@/core/tokens/codec";
import { QR_TOKEN_VERSION, type VerifyResult } from "@/core/tokens/payload";

/**
 * Verifies a scanned QR with zero network calls (design doc §4.1).
 *
 * Signature is checked before the version is judged: an unsigned or forged
 * token should read as "not for this event", never as "your app is out of
 * date". Only the signature check distinguishes a real pass from a made-up one.
 */
export async function verifyToken(
  token: string,
  verifier: TokenVerifier,
): Promise<VerifyResult> {
  const split = splitToken(token);
  if (split === null) return { ok: false, reason: "malformed" };

  const payload = decodePayload(split.encoded);
  if (payload === null) return { ok: false, reason: "malformed" };

  const signatureValid = await verifier.verify(
    utf8Encode(split.encoded),
    split.signature,
  );
  if (!signatureValid) return { ok: false, reason: "bad_signature" };

  if (payload.version !== QR_TOKEN_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }

  return { ok: true, payload };
}

/** Peels the trailing signature field off the token. */
function splitToken(token: string): { encoded: string; signature: Bytes } | null {
  const lastSeparator = token.lastIndexOf(".");
  if (lastSeparator <= 0 || lastSeparator === token.length - 1) return null;

  const signature = decodeBase64Url(token.slice(lastSeparator + 1));
  if (signature === null || signature.length === 0) return null;

  return { encoded: token.slice(0, lastSeparator), signature };
}
