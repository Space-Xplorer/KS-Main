import type { LocalRegistration } from "@/core/attendance/check-in";
import type { AttendanceDB, RegistrationRow } from "@/infra/dexie/db";

/**
 * Local registration cache, populated during provisioning (design doc §4.4)
 * and consulted by the scanner with no network call.
 */

export async function seedRegistrations(
  db: AttendanceDB,
  rows: readonly RegistrationRow[],
): Promise<void> {
  await db.registrations.bulkPut(rows);
}

/** Matches the CheckInDeps.findRegistration shape exactly. */
export async function findRegistration(
  db: AttendanceDB,
  registrationId: string,
): Promise<LocalRegistration | null> {
  const row = await db.registrations.get(registrationId);
  return row ?? null;
}

/**
 * Records this device's own belief about a check-in, so the *next* scan on
 * *this* device sees it as a duplicate immediately, before any sync happens.
 * Cross-device duplicates are still caught, but only after a sync round trip
 * — that lag is inherent to being offline, not a bug here.
 */
export async function markCheckedInLocally(
  db: AttendanceDB,
  registrationId: string,
  at: number,
): Promise<void> {
  await db.registrations.update(registrationId, { checkedInAt: at });
}

export async function registrationCount(db: AttendanceDB): Promise<number> {
  return db.registrations.count();
}
