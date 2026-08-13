import type { AttendanceDB, OutboxRow } from "@/infra/dexie/db";
import type {
  NewOutboxRecord,
  Outbox,
  OutboxRecord,
} from "@/core/sync/outbox";

/**
 * IndexedDB implementation of the Outbox port, via Dexie.
 *
 * This is the real counterpart to MemoryOutbox in src/infra/testing/fakes.ts
 * — same contract, so SyncEngine cannot tell them apart. That is what lets
 * the engine's tests stand in for this file's behaviour.
 */
export class DexieOutbox implements Outbox {
  readonly #db: AttendanceDB;

  constructor(db: AttendanceDB) {
    this.#db = db;
  }

  async enqueue(record: NewOutboxRecord, now: number): Promise<void> {
    // Idempotent on id: a double-tap on "check in" must not create two rows.
    const existing = await this.#db.outbox.get(record.id);
    if (existing) return;

    const row: OutboxRow = {
      id: record.id,
      kind: record.kind,
      payload: record.payload,
      status: "pending",
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    };
    await this.#db.outbox.add(row);
  }

  async listDue(now: number, limit: number): Promise<readonly OutboxRecord[]> {
    const rows = await this.#db.outbox
      .where("status")
      .equals("pending")
      .and((row) => row.nextAttemptAt <= now)
      .sortBy("createdAt");

    return rows.slice(0, limit).map(toRecord);
  }

  async markSynced(ids: readonly string[], _now: number): Promise<void> {
    await this.#db.outbox.bulkUpdate(
      ids.map((id) => ({ key: id, changes: { status: "synced" as const } })),
    );
  }

  async markRetry(
    ids: readonly string[],
    error: string,
    nextAttemptAt: number,
  ): Promise<void> {
    await this.#db.transaction("rw", this.#db.outbox, async () => {
      for (const id of ids) {
        const row = await this.#db.outbox.get(id);
        if (!row) continue;
        await this.#db.outbox.update(id, {
          attempts: row.attempts + 1,
          nextAttemptAt,
          lastError: error,
        });
      }
    });
  }

  async markRejected(
    ids: readonly string[],
    error: string,
    _now: number,
  ): Promise<void> {
    await this.#db.outbox.bulkUpdate(
      ids.map((id) => ({
        key: id,
        changes: { status: "rejected" as const, lastError: error },
      })),
    );
  }

  async pendingCount(): Promise<number> {
    return this.#db.outbox.where("status").equals("pending").count();
  }
}

function toRecord(row: OutboxRow): OutboxRecord {
  return row;
}
