import type { Clock, IdGenerator, TokenSigner } from "@/core/ports";
import { QR_TOKEN_VERSION, type QrTokenPayload } from "@/core/tokens/payload";
import { signToken } from "@/core/tokens/sign";

/**
 * Walk-in registration at the venue (design doc §4.2).
 *
 * The id is generated on the device, not fetched from the server, which is
 * what removes the coordination problem: two desks can register people at the
 * same moment with no connectivity and never collide. The QR is signed and
 * displayed immediately — the attendee screenshots it on the spot.
 */

export interface WalkinInput {
  readonly eventId: string;
  readonly deviceId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
}

export interface WalkinRegistration {
  readonly registrationId: string;
  readonly eventId: string;
  readonly source: "walkin";
  readonly issuedByDeviceId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  /** Epoch ms. */
  readonly createdAt: number;
  /** The signed token to render as a QR and to store. */
  readonly qrToken: string;
}

export type WalkinError =
  | "name_required"
  | "invalid_email"
  | "token_generation_failed";

export type WalkinResult =
  | { readonly ok: true; readonly registration: WalkinRegistration }
  | { readonly ok: false; readonly reason: WalkinError };

export interface WalkinDeps {
  readonly signer: TokenSigner;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Deliberately permissive: at a busy desk, a half-typed email must not block
 * someone from getting in. Only the name is required, because that is the one
 * field a volunteer needs in order to read the result back to the attendee.
 */
export async function createWalkinRegistration(
  input: WalkinInput,
  deps: WalkinDeps,
): Promise<WalkinResult> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, reason: "name_required" };

  const email = normalizeOptional(input.email);
  if (email !== null && !looksLikeEmail(email)) {
    return { ok: false, reason: "invalid_email" };
  }

  const registrationId = deps.ids.newId();
  const createdAt = deps.clock.now();

  const payload: QrTokenPayload = {
    version: QR_TOKEN_VERSION,
    eventId: input.eventId,
    registrationId,
    issuedBy: input.deviceId,
    // Seconds, not milliseconds — three fewer characters in the QR.
    issuedAt: Math.floor(createdAt / 1000),
  };

  const qrToken = await signToken(payload, deps.signer);
  if (qrToken === null) return { ok: false, reason: "token_generation_failed" };

  return {
    ok: true,
    registration: {
      registrationId,
      eventId: input.eventId,
      source: "walkin",
      issuedByDeviceId: input.deviceId,
      name,
      email,
      phone: normalizeOptional(input.phone),
      createdAt,
      qrToken,
    },
  };
}

function normalizeOptional(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * A shape check, not RFC 5322 validation. The purpose is catching a typo like
 * a missing "@" while the attendee is still standing there, not rejecting
 * exotic-but-legal addresses.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
