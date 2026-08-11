/**
 * The local-first write queue (design doc §4.3).
 *
 * Every walk-in registration and every check-in lands here first and is shown
 * to the volunteer immediately. Reaching Supabase is a separate, later,
 * retryable concern. One queue serves both record kinds — the engine never
 * needs to know which is which, which is the Open/Closed claim in doc §5 made
 * concrete rather than aspirational.
 */

/** What a record is doing right now. */
export type OutboxStatus =
  /** Waiting to be pushed, or waiting out a backoff before the next attempt. */
  | "pending"
  /** Confirmed accepted by the server. Safe to prune. */
  | "synced"
  /**
   * The server actively rejected this record and always will (malformed,
   * unknown event). Retrying cannot help, so it stops consuming attempts and
   * surfaces in the reconciliation view for a human to look at.
   */
  | "rejected";

/** Discriminates payload shapes without the engine having to understand them. */
export type OutboxKind = "registration" | "checkin";

export interface OutboxRecord<TPayload = unknown> {
  /**
   * Client-generated UUID, and the idempotency key end to end. The server
   * upserts on this, so re-pushing a record the server already accepted is a
   * no-op rather than a duplicate row.
   */
  readonly id: string;
  readonly kind: OutboxKind;
  readonly payload: TPayload;
  readonly status: OutboxStatus;
  readonly createdAt: number;
  /** How many push attempts have already failed for this record. */
  readonly attempts: number;
  /** Epoch ms before which this record should not be retried. */
  readonly nextAttemptAt: number;
  readonly lastError?: string;
}

/** A new record, before the outbox assigns bookkeeping fields. */
export interface NewOutboxRecord<TPayload = unknown> {
  readonly id: string;
  readonly kind: OutboxKind;
  readonly payload: TPayload;
}

/**
 * Storage port. Implemented over IndexedDB in src/infra/dexie/ for real use,
 * and in memory for tests.
 */
export interface Outbox {
  /**
   * Adds a record. MUST be idempotent on id: enqueuing the same id twice
   * leaves one record, so a double-tap on "check in" cannot create two rows.
   */
  enqueue(record: NewOutboxRecord, now: number): Promise<void>;

  /** Pending records whose nextAttemptAt has passed, oldest first. */
  listDue(now: number, limit: number): Promise<readonly OutboxRecord[]>;

  markSynced(ids: readonly string[], now: number): Promise<void>;

  /** Transient failure: bump attempts and schedule the next try. */
  markRetry(
    ids: readonly string[],
    error: string,
    nextAttemptAt: number,
  ): Promise<void>;

  /** Permanent failure: stop retrying, keep the record for reconciliation. */
  markRejected(ids: readonly string[], error: string, now: number): Promise<void>;

  /** Drives the "N unsynced" badge the volunteer watches. */
  pendingCount(): Promise<number>;
}

/**
 * Result of pushing one batch.
 *
 * A thrown error means a transient problem (no signal, 5xx) and retries the
 * whole batch. Returning a record in rejectedIds means the server refused it
 * on the merits and will keep refusing it.
 */
export interface PushResult {
  readonly syncedIds: readonly string[];
  readonly rejectedIds: readonly { readonly id: string; readonly error: string }[];
}

export interface RemotePusher {
  push(batch: readonly OutboxRecord[]): Promise<PushResult>;
}
