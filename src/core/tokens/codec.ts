import { decodeBase64Url, encodeBase64Url } from "@/core/encoding/base64url";
import { bytesToUuid, uuidToBytes } from "@/core/encoding/uuid";
import { utf8Decode, utf8Encode } from "@/core/encoding/utf8";
import { QR_TOKEN_VERSION, type QrTokenPayload } from "@/core/tokens/payload";

/**
 * Canonical wire format for the signed part of a token:
 *
 *   <version><SEP><eventId><SEP><registrationId><SEP><issuedBy><SEP><issuedAt>
 *
 * Versions and timestamps are base36; UUIDs are their raw 16 bytes in
 * base64url (22 chars instead of 36); issuedBy is base64url of its UTF-8
 * bytes so a device id can never contain the separator.
 *
 * This encoding is what gets signed, so it must be byte-for-byte stable.
 * Changing it without bumping QR_TOKEN_VERSION invalidates every issued pass.
 */

const SEP = ".";
const FIELD_COUNT = 5;

/** Encodes the signed portion. Returns null if the payload is not encodable. */
export function encodePayload(payload: QrTokenPayload): string | null {
  const eventBytes = uuidToBytes(payload.eventId);
  const registrationBytes = uuidToBytes(payload.registrationId);
  if (eventBytes === null || registrationBytes === null) return null;

  if (!Number.isSafeInteger(payload.issuedAt) || payload.issuedAt < 0) return null;
  if (!Number.isSafeInteger(payload.version) || payload.version < 0) return null;
  if (payload.issuedBy.length === 0) return null;

  return [
    payload.version.toString(36),
    encodeBase64Url(eventBytes),
    encodeBase64Url(registrationBytes),
    encodeBase64Url(utf8Encode(payload.issuedBy)),
    payload.issuedAt.toString(36),
  ].join(SEP);
}

/** Parses the signed portion. Returns null on anything malformed. */
export function decodePayload(text: string): QrTokenPayload | null {
  const parts = text.split(SEP);
  if (parts.length !== FIELD_COUNT) return null;

  const [versionText, eventText, registrationText, issuerText, issuedAtText] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  const version = parseBase36(versionText);
  const issuedAt = parseBase36(issuedAtText);
  if (version === null || issuedAt === null) return null;

  const eventBytes = decodeBase64Url(eventText);
  const registrationBytes = decodeBase64Url(registrationText);
  const issuerBytes = decodeBase64Url(issuerText);
  if (eventBytes === null || registrationBytes === null || issuerBytes === null) {
    return null;
  }

  const eventId = bytesToUuid(eventBytes);
  const registrationId = bytesToUuid(registrationBytes);
  const issuedBy = utf8Decode(issuerBytes);
  if (eventId === null || registrationId === null || issuedBy === null) return null;
  if (issuedBy.length === 0) return null;

  return { version, eventId, registrationId, issuedBy, issuedAt };
}

/**
 * Strict base36: rejects anything toString(36) would never emit, so that a
 * tampered token cannot round-trip through a lenient parse. parseInt would
 * happily read "12xyz" as 12.
 */
function parseBase36(text: string): number | null {
  if (text.length === 0 || !/^[0-9a-z]+$/.test(text)) return null;

  const value = Number.parseInt(text, 36);
  if (!Number.isSafeInteger(value)) return null;
  if (value.toString(36) !== text) return null;

  return value;
}

export { QR_TOKEN_VERSION };
