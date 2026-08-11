import { encodeBase64Url } from "@/core/encoding/base64url";
import { utf8Encode } from "@/core/encoding/utf8";
import type { TokenSigner } from "@/core/ports";
import { encodePayload } from "@/core/tokens/codec";
import type { QrTokenPayload } from "@/core/tokens/payload";

/**
 * Produces the full token string that goes into the QR:
 *
 *   <signed payload>.<signature in base64url>
 *
 * The payload itself contains exactly 5 separator-delimited fields, so the
 * signature is always the 6th and last — see splitToken in verify.ts.
 *
 * Returns null if the payload cannot be encoded (bad UUID, negative
 * timestamp). Callers treat that as a programming error, not a user error.
 */
export async function signToken(
  payload: QrTokenPayload,
  signer: TokenSigner,
): Promise<string | null> {
  const encoded = encodePayload(payload);
  if (encoded === null) return null;

  const signature = await signer.sign(utf8Encode(encoded));
  return `${encoded}.${encodeBase64Url(signature)}`;
}
