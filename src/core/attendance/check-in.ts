import type { Clock, IdGenerator, TokenVerifier } from "@/core/ports";
import type { TokenError } from "@/core/tokens/payload";
import { verifyToken } from "@/core/tokens/verify";

/**
 * Deciding what happens when a QR is scanned at a lane (design doc §4.5).
 *
 * Everything here is local. The scanner authenticates the token against the
 * event secret it was provisioned with and consults only what this device
 * already knows, so a scan resolves in milliseconds with no signal.
 */

/** What this device currently knows about a registration, from provisioning + local scans. */
export interface LocalRegistration {
  readonly registrationId: string;
  readonly eventId: string;
  readonly displayName: string | null;
  /** Earliest check-in this device has seen. Null if not yet checked in here. */
  readonly checkedInAt: number | null;
}

/** One row of the audit trail. Written for accepted AND duplicate scans alike. */
export interface CheckinEventRecord {
  readonly id: string;
  readonly registrationId: string;
  readonly deviceId: string;
  readonly scannedAt: number;
  readonly isDuplicate: boolean;
}

export type CheckInRejection =
  | TokenError
  /** Genuine token, wrong event — a pass from a different event entirely. */
  | "wrong_event"
  /**
   * Correctly signed but this device has never heard of the registration.
   * Usually a walk-in registered at another lane that has not synced yet,
   * NOT a forgery — the UI must say so, or volunteers will turn away real people.
   */
  | "unknown_registration";

export type CheckInDecision =
  | {
      readonly status: "accepted";
      readonly record: CheckinEventRecord;
      readonly displayName: string | null;
    }
  | {
      readonly status: "duplicate";
      readonly record: CheckinEventRecord;
      readonly displayName: string | null;
      /** When this device believes they first came in, for "already in at 6:42 PM". */
      readonly firstSeenAt: number;
    }
  | { readonly status: "rejected"; readonly reason: CheckInRejection };

export interface ScanContext {
  /** The event this device was provisioned for. */
  readonly eventId: string;
  readonly deviceId: string;
}

export interface CheckInDeps {
  readonly verifier: TokenVerifier;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Local lookup, typically IndexedDB. Returns null if unknown to this device. */
  readonly findRegistration: (
    registrationId: string,
  ) => Promise<LocalRegistration | null>;
}

/**
 * Full scan path: authenticate the token, then decide.
 *
 * Note the ordering — authenticity is settled before any lookup, so an
 * unknown-but-forged token never reaches the local database.
 */
export async function checkIn(
  token: string,
  context: ScanContext,
  deps: CheckInDeps,
): Promise<CheckInDecision> {
  const verified = await verifyToken(token, deps.verifier);
  if (!verified.ok) {
    return { status: "rejected", reason: verified.reason };
  }

  if (verified.payload.eventId !== context.eventId) {
    return { status: "rejected", reason: "wrong_event" };
  }

  const registration = await deps.findRegistration(verified.payload.registrationId);
  if (registration === null) {
    return { status: "rejected", reason: "unknown_registration" };
  }

  return decideCheckIn(registration, context, {
    scannedAt: deps.clock.now(),
    checkinId: deps.ids.newId(),
  });
}

/**
 * The decision itself, with all IO already done.
 *
 * Split out and kept pure so the duplicate rules can be tested exhaustively
 * without a signer, a database, or a clock.
 */
export function decideCheckIn(
  registration: LocalRegistration,
  context: ScanContext,
  moment: { readonly scannedAt: number; readonly checkinId: string },
): CheckInDecision {
  const alreadyIn = registration.checkedInAt !== null;

  const record: CheckinEventRecord = {
    id: moment.checkinId,
    registrationId: registration.registrationId,
    deviceId: context.deviceId,
    scannedAt: moment.scannedAt,
    isDuplicate: alreadyIn,
  };

  // A duplicate is recorded, never dropped. Someone trying to reuse a
  // screenshot of a friend's pass is exactly what this audit row is for.
  if (alreadyIn) {
    return {
      status: "duplicate",
      record,
      displayName: registration.displayName,
      firstSeenAt: registration.checkedInAt as number,
    };
  }

  return { status: "accepted", record, displayName: registration.displayName };
}
