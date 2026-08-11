import type { Clock } from "@/core/ports";
import type { Outbox, OutboxRecord, RemotePusher } from "@/core/sync/outbox";

/**
 * Drains the outbox toward the server (design doc §4.3).
 *
 * The engine is deliberately dumb about what it is syncing. It moves opaque
 * records, retries transient failures with backoff, and refuses to drop
 * anything it has not seen confirmed. Registration and check-in both ride it
 * without either knowing the other exists.
 *
 * Callers drive it: a "Sync Now" button, the browser `online` event, tab
 * foreground, and a ~20-30s timer. Background Sync API is deliberately not
 * used — doc §2 records why (unreliable on iOS Safari).
 */

export interface SyncEngineOptions {
  /** Records per push. Small enough to fit a bad connection's patience window. */
  readonly batchSize: number;
  /** First retry delay; doubles per attempt. */
  readonly baseBackoffMs: number;
  /** Ceiling on the doubling, so a long outage still retries regularly. */
  readonly maxBackoffMs: number;
}

export const DEFAULT_SYNC_OPTIONS: SyncEngineOptions = {
  batchSize: 50,
  baseBackoffMs: 2_000,
  maxBackoffMs: 60_000,
};

export interface SyncReport {
  readonly attempted: number;
  readonly synced: number;
  /** Permanently refused by the server; surfaced for a human to review. */
  readonly rejected: number;
  /** Transient failure — still queued, will be retried. */
  readonly retrying: number;
  /** Drives the badge the volunteer watches. */
  readonly pendingAfter: number;
}

const EMPTY_REPORT: SyncReport = {
  attempted: 0,
  synced: 0,
  rejected: 0,
  retrying: 0,
  pendingAfter: 0,
};

export class SyncEngine {
  readonly #outbox: Outbox;
  readonly #pusher: RemotePusher;
  readonly #clock: Clock;
  readonly #options: SyncEngineOptions;

  /** Guards against a timer tick overlapping a manual "Sync Now" tap. */
  #draining = false;

  constructor(
    outbox: Outbox,
    pusher: RemotePusher,
    clock: Clock,
    options: SyncEngineOptions = DEFAULT_SYNC_OPTIONS,
  ) {
    this.#outbox = outbox;
    this.#pusher = pusher;
    this.#clock = clock;
    this.#options = options;
  }

  /** True while a drain is in flight, for spinner state. */
  get isDraining(): boolean {
    return this.#draining;
  }

  /**
   * Pushes one batch of due records.
   *
   * Returns rather than throws on network failure: losing signal is the
   * expected state at the venue, not an exception. Concurrent calls are
   * collapsed — the second returns an empty report instead of double-sending.
   */
  async drain(): Promise<SyncReport> {
    if (this.#draining) return EMPTY_REPORT;
    this.#draining = true;

    try {
      const now = this.#clock.now();
      const batch = await this.#outbox.listDue(now, this.#options.batchSize);

      if (batch.length === 0) {
        return { ...EMPTY_REPORT, pendingAfter: await this.#outbox.pendingCount() };
      }

      return await this.#pushBatch(batch);
    } finally {
      this.#draining = false;
    }
  }

  /** Repeatedly drains until nothing is due, or a batch stops making progress. */
  async drainAll(): Promise<SyncReport> {
    let totals = { ...EMPTY_REPORT };

    for (;;) {
      const report = await this.drain();
      totals = {
        attempted: totals.attempted + report.attempted,
        synced: totals.synced + report.synced,
        rejected: totals.rejected + report.rejected,
        retrying: totals.retrying + report.retrying,
        pendingAfter: report.pendingAfter,
      };

      // Stop when the batch was empty, or when nothing advanced — otherwise a
      // persistently failing batch would spin forever.
      const progressed = report.synced > 0 || report.rejected > 0;
      if (report.attempted === 0 || !progressed) return totals;
    }
  }

  async #pushBatch(batch: readonly OutboxRecord[]): Promise<SyncReport> {
    let result;
    try {
      result = await this.#pusher.push(batch);
    } catch (error) {
      // Transient: no signal, timeout, 5xx. Keep every record, back off.
      await this.#scheduleRetry(batch, describeError(error));
      return {
        attempted: batch.length,
        synced: 0,
        rejected: 0,
        retrying: batch.length,
        pendingAfter: await this.#outbox.pendingCount(),
      };
    }

    const now = this.#clock.now();
    const syncedIds = result.syncedIds;
    const rejected = result.rejectedIds;

    if (syncedIds.length > 0) {
      await this.#outbox.markSynced(syncedIds, now);
    }

    for (const { id, error } of rejected) {
      await this.#outbox.markRejected([id], error, now);
    }

    // Anything the server neither confirmed nor refused stays queued. Silence
    // is not consent: an unmentioned record must be retried, never assumed sent.
    const accounted = new Set<string>([...syncedIds, ...rejected.map((r) => r.id)]);
    const unaccounted = batch.filter((record) => !accounted.has(record.id));
    if (unaccounted.length > 0) {
      await this.#scheduleRetry(unaccounted, "server did not acknowledge record");
    }

    return {
      attempted: batch.length,
      synced: syncedIds.length,
      rejected: rejected.length,
      retrying: unaccounted.length,
      pendingAfter: await this.#outbox.pendingCount(),
    };
  }

  async #scheduleRetry(
    records: readonly OutboxRecord[],
    error: string,
  ): Promise<void> {
    const now = this.#clock.now();

    // Group by attempt count so each record backs off according to its own
    // history rather than the batch's.
    const byAttempts = new Map<number, string[]>();
    for (const record of records) {
      const ids = byAttempts.get(record.attempts) ?? [];
      ids.push(record.id);
      byAttempts.set(record.attempts, ids);
    }

    for (const [attempts, ids] of byAttempts) {
      await this.#outbox.markRetry(ids, error, now + this.#backoffFor(attempts));
    }
  }

  /** Exponential, capped, and deterministic — jitter would make tests flaky. */
  #backoffFor(attempts: number): number {
    const { baseBackoffMs, maxBackoffMs } = this.#options;
    const exponent = Math.min(attempts, 30);
    return Math.min(baseBackoffMs * 2 ** exponent, maxBackoffMs);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
