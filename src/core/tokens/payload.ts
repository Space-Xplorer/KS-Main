/**
 * The contents of a QR code issued to a registrant.
 *
 * Design doc §4.1: the token is self-verifying. A scanner recomputes the
 * signature locally and decides "is this QR real" with zero network calls,
 * which is the whole point — it decouples authenticity from having signal.
 */

export const QR_TOKEN_VERSION = 1;

/** Marks a token issued by the online pre-registration flow rather than a device. */
export const ISSUER_ONLINE = "online";

export interface QrTokenPayload {
  /** Bumped if the wire format ever changes; old scanners reject unknown versions. */
  readonly version: number;
  /** UUID of the event this token is valid for. */
  readonly eventId: string;
  /** Client-generated UUID of the registration. */
  readonly registrationId: string;
  /** Device id of the issuing walk-in desk, or ISSUER_ONLINE. */
  readonly issuedBy: string;
  /** Epoch seconds. Seconds, not milliseconds — three fewer characters in the QR. */
  readonly issuedAt: number;
}

export type TokenError =
  /** Not a well-formed token: wrong shape, bad base64, bad UUID bytes. */
  | "malformed"
  /** Well-formed but a version this build does not understand. */
  | "unsupported_version"
  /** Well-formed, but not signed by this event's secret. */
  | "bad_signature";

export type VerifyResult =
  | { readonly ok: true; readonly payload: QrTokenPayload }
  | { readonly ok: false; readonly reason: TokenError };

/**
 * Human-readable text for each failure.
 *
 * These end up in front of a volunteer at the gate, so they say what to do
 * rather than what went wrong internally. "Bad signature" in particular is
 * usually last year's QR or another event's, not an attack.
 */
export const TOKEN_ERROR_MESSAGE: Record<TokenError, string> = {
  malformed: "Not a valid pass. Ask them to reopen their QR and try again.",
  unsupported_version: "This pass was made by a newer app version. Update this device.",
  bad_signature: "This pass is not for this event. Send them to the registration desk.",
};
