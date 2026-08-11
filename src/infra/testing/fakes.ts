import type { Clock, IdGenerator } from "@/core/ports";
import type {
  NewOutboxRecord,
  Outbox,
  OutboxRecord,
  PushResult,
  RemotePusher,
} from "@/core/sync/outbox";

/**
 * Test doubles for the core ports.
 *
 * These live in infra, not core, because core must not know that tests exist.
 * They are the reason the domain suite runs with no browser, no database and
 * no network — and therefore fast enough to run on every save.
 */

/** A clock you move by hand, so "earliest wins" is testable without sleeping. */
export class FakeClock implements Clock {
  #now: number;

  constructor(start = 1_700_000_000_000) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  advance(ms: number): this {
    this.#now += ms;
    return this;
  }

  set(ms: number): this {
    this.#now = ms;
    return this;
  }
}

/**
 * Deterministic ids that are still structurally valid UUIDs — the token codec
 * validates the shape, so a fake like "id-1" would fail for the wrong reason.
 */
export class SeqIdGenerator implements IdGenerator {
  #next = 0;
  readonly #prefix: string;

  constructor(prefix = "00000000-0000-4000-8000-") {
    this.#prefix = prefix;
  }

  newId(): string {
    this.#next += 1;
    return this.#prefix + this.#next.toString(16).padStart(12, "0");
  }
}

/** In-memory Outbox with the same contract as the Dexie one. */
export class MemoryOutbox implements Outbox {
  readonly #records = new Map<string, OutboxRecord>();

  async enqueue(record: NewOutboxRecord, now: number): Promise<void> {
    // Idempotent on id: a double-tap must not create two rows.
    if (this.#records.has(record.id)) return;

    this.#records.set(record.id, {
      id: record.id,
      kind: record.kind,
      payload: record.payload,
      status: "pending",
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    });
  }

  async listDue(now: number, limit: number): Promise<readonly OutboxRecord[]> {
    return [...this.#records.values()]
      .filter((r) => r.status === "pending" && r.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
      .slice(0, limit);
  }

  async markSynced(ids: readonly string[], _now: number): Promise<void> {
    for (const id of ids) {
      const record = this.#records.get(id);
      if (record) this.#records.set(id, { ...record, status: "synced" });
    }
  }

  async markRetry(
    ids: readonly string[],
    error: string,
    nextAttemptAt: number,
  ): Promise<void> {
    for (const id of ids) {
      const record = this.#records.get(id);
      if (!record) continue;
      this.#records.set(id, {
        ...record,
        attempts: record.attempts + 1,
        nextAttemptAt,
        lastError: error,
      });
    }
  }

  async markRejected(
    ids: readonly string[],
    error: string,
    _now: number,
  ): Promise<void> {
    for (const id of ids) {
      const record = this.#records.get(id);
      if (!record) continue;
      this.#records.set(id, { ...record, status: "rejected", lastError: error });
    }
  }

  async pendingCount(): Promise<number> {
    return [...this.#records.values()].filter((r) => r.status === "pending").length;
  }

  // --- test inspection helpers ---

  all(): readonly OutboxRecord[] {
    return [...this.#records.values()];
  }

  get(id: string): OutboxRecord | undefined {
    return this.#records.get(id);
  }

  get size(): number {
    return this.#records.size;
  }
}

/**
 * A pusher whose behaviour is scripted per call, for exercising the paths that
 * matter: losing signal mid-batch, partial acceptance, outright rejection.
 */
export class ScriptedPusher implements RemotePusher {
  readonly #script: PusherBehaviour[];
  readonly #seen: (readonly OutboxRecord[])[] = [];
  #call = 0;

  constructor(script: PusherBehaviour[]) {
    this.#script = script;
  }

  /** Every batch it was handed, in order — for asserting nothing was dropped. */
  get batches(): readonly (readonly OutboxRecord[])[] {
    return this.#seen;
  }

  get callCount(): number {
    return this.#call;
  }

  async push(batch: readonly OutboxRecord[]): Promise<PushResult> {
    this.#seen.push([...batch]);
    // Past the end of the script, behave like a healthy server.
    const behaviour = this.#script[this.#call] ?? { type: "accept-all" };
    this.#call += 1;

    switch (behaviour.type) {
      case "throw":
        throw new Error(behaviour.message);

      case "accept-all":
        return { syncedIds: batch.map((r) => r.id), rejectedIds: [] };

      case "silent":
        // Acknowledges nothing. The engine must keep every record queued.
        return { syncedIds: [], rejectedIds: [] };

      case "partial": {
        const accepted = batch.slice(0, behaviour.acceptCount).map((r) => r.id);
        return { syncedIds: accepted, rejectedIds: [] };
      }

      case "reject-all":
        return {
          syncedIds: [],
          rejectedIds: batch.map((r) => ({ id: r.id, error: behaviour.error })),
        };
    }
  }
}

export type PusherBehaviour =
  | { type: "accept-all" }
  | { type: "throw"; message: string }
  | { type: "silent" }
  | { type: "partial"; acceptCount: number }
  | { type: "reject-all"; error: string };
