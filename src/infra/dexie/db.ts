import Dexie, { type EntityTable } from "dexie";

import type { OutboxKind, OutboxStatus } from "@/core/sync/outbox";

/**
 * The on-device database. One per browser/device — this is deliberately not
 * synced or shared, which is the whole point of local-first writes.
 */

export interface RegistrationRow {
  readonly registrationId: string;
  readonly eventId: string;
  readonly displayName: string | null;
  /** Epoch ms, or null if this device has not seen a check-in for them yet. */
  checkedInAt: number | null;
}

export interface OutboxRow {
  readonly id: string;
  readonly kind: OutboxKind;
  readonly payload: unknown;
  status: OutboxStatus;
  readonly createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export class AttendanceDB extends Dexie {
  registrations!: EntityTable<RegistrationRow, "registrationId">;
  outbox!: EntityTable<OutboxRow, "id">;

  constructor() {
    super("ks-attendance");

    this.version(1).stores({
      // checkedInAt indexed: the scanner needs "who is not yet in" to be fast.
      registrations: "registrationId, eventId, checkedInAt",
      // [status+nextAttemptAt] is what listDue() scans.
      outbox: "id, status, [status+nextAttemptAt]",
    });
  }
}

let instance: AttendanceDB | null = null;

/** Lazy singleton — Dexie must not be constructed until a browser exists. */
export function getDB(): AttendanceDB {
  instance ??= new AttendanceDB();
  return instance;
}
