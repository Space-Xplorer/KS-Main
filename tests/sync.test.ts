import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SYNC_OPTIONS, SyncEngine } from "@/core/sync/engine";
import type { NewOutboxRecord } from "@/core/sync/outbox";
import { FakeClock, MemoryOutbox, ScriptedPusher } from "@/infra/testing/fakes";

/**
 * The sync layer is the highest-risk code in the system: it runs unattended,
 * on a bad connection, holding the only copy of a check-in. These tests exist
 * to prove it never loses a record.
 */

const START = 1_754_700_000_000;

let clock: FakeClock;
let outbox: MemoryOutbox;

beforeEach(() => {
  clock = new FakeClock(START);
  outbox = new MemoryOutbox();
});

function checkin(id: string): NewOutboxRecord {
  return { id, kind: "checkin", payload: { registrationId: id } };
}

async function seed(count: number): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await outbox.enqueue(checkin(`record-${i}`), clock.now());
  }
}

describe("outbox", () => {
  it("is idempotent on id, so a double-tap enqueues once", async () => {
    await outbox.enqueue(checkin("same"), clock.now());
    await outbox.enqueue(checkin("same"), clock.now());

    expect(outbox.size).toBe(1);
    expect(await outbox.pendingCount()).toBe(1);
  });
});

describe("SyncEngine", () => {
  it("marks records synced when the server accepts them", async () => {
    await seed(3);
    const pusher = new ScriptedPusher([{ type: "accept-all" }]);

    const report = await new SyncEngine(outbox, pusher, clock).drain();

    expect(report).toMatchObject({ attempted: 3, synced: 3, retrying: 0 });
    expect(await outbox.pendingCount()).toBe(0);
  });

  it("keeps every record when the connection drops mid-push", async () => {
    await seed(3);
    const pusher = new ScriptedPusher([{ type: "throw", message: "network down" }]);

    const report = await new SyncEngine(outbox, pusher, clock).drain();

    expect(report).toMatchObject({ synced: 0, retrying: 3 });
    // The critical assertion: nothing was lost.
    expect(await outbox.pendingCount()).toBe(3);
    expect(outbox.get("record-1")?.lastError).toBe("network down");
  });

  it("keeps records the server never acknowledged — silence is not consent", async () => {
    await seed(2);
    const pusher = new ScriptedPusher([{ type: "silent" }]);

    const report = await new SyncEngine(outbox, pusher, clock).drain();

    expect(report).toMatchObject({ synced: 0, rejected: 0, retrying: 2 });
    expect(await outbox.pendingCount()).toBe(2);
  });

  it("retains the unconfirmed remainder of a partially accepted batch", async () => {
    await seed(5);
    const pusher = new ScriptedPusher([{ type: "partial", acceptCount: 2 }]);

    const report = await new SyncEngine(outbox, pusher, clock).drain();

    expect(report).toMatchObject({ attempted: 5, synced: 2, retrying: 3 });
    expect(await outbox.pendingCount()).toBe(3);
  });

  it("stops retrying records the server permanently refused", async () => {
    await seed(2);
    const pusher = new ScriptedPusher([{ type: "reject-all", error: "unknown event" }]);

    const report = await new SyncEngine(outbox, pusher, clock).drain();

    expect(report).toMatchObject({ rejected: 2, retrying: 0 });
    expect(await outbox.pendingCount()).toBe(0);
    // Kept, not deleted — the reconciliation view needs to show these.
    expect(outbox.get("record-1")?.status).toBe("rejected");
    expect(outbox.get("record-1")?.lastError).toBe("unknown event");
  });

  it("backs off exponentially instead of hammering a dead connection", async () => {
    await seed(1);
    const pusher = new ScriptedPusher([
      { type: "throw", message: "down" },
      { type: "throw", message: "down" },
    ]);
    const engine = new SyncEngine(outbox, pusher, clock);

    await engine.drain();
    expect(outbox.get("record-1")?.nextAttemptAt).toBe(
      START + DEFAULT_SYNC_OPTIONS.baseBackoffMs,
    );

    // Still backing off: a drain before the deadline must not send anything.
    const early = await engine.drain();
    expect(early.attempted).toBe(0);
    expect(pusher.callCount).toBe(1);

    // After the delay it retries, and the next backoff has doubled.
    clock.advance(DEFAULT_SYNC_OPTIONS.baseBackoffMs);
    await engine.drain();
    expect(outbox.get("record-1")?.attempts).toBe(2);
    expect(outbox.get("record-1")?.nextAttemptAt).toBe(
      clock.now() + DEFAULT_SYNC_OPTIONS.baseBackoffMs * 2,
    );
  });

  it("caps the backoff so a long outage still retries regularly", async () => {
    await seed(1);
    const engine = new SyncEngine(
      outbox,
      new ScriptedPusher(Array(12).fill({ type: "throw", message: "down" })),
      clock,
      { batchSize: 10, baseBackoffMs: 1_000, maxBackoffMs: 8_000 },
    );

    for (let i = 0; i < 10; i += 1) {
      await engine.drain();
      clock.advance(60_000);
    }

    const record = outbox.get("record-1")!;
    expect(record.nextAttemptAt - clock.now() + 60_000).toBeLessThanOrEqual(8_000);
  });

  it("recovers everything once the connection returns", async () => {
    await seed(4);
    const pusher = new ScriptedPusher([
      { type: "throw", message: "down" },
      { type: "accept-all" },
    ]);
    const engine = new SyncEngine(outbox, pusher, clock);

    await engine.drain();
    clock.advance(DEFAULT_SYNC_OPTIONS.baseBackoffMs);
    const report = await engine.drain();

    expect(report.synced).toBe(4);
    expect(await outbox.pendingCount()).toBe(0);
  });

  it("re-sends the same ids after a failure, so the server upsert is a no-op", async () => {
    await seed(2);
    const pusher = new ScriptedPusher([
      { type: "throw", message: "down" },
      { type: "accept-all" },
    ]);
    const engine = new SyncEngine(outbox, pusher, clock);

    await engine.drain();
    clock.advance(DEFAULT_SYNC_OPTIONS.baseBackoffMs);
    await engine.drain();

    const [first, second] = pusher.batches;
    expect(second!.map((r) => r.id)).toEqual(first!.map((r) => r.id));
  });

  it("respects the batch size", async () => {
    await seed(120);
    const engine = new SyncEngine(outbox, new ScriptedPusher([]), clock, {
      ...DEFAULT_SYNC_OPTIONS,
      batchSize: 50,
    });

    const report = await engine.drain();

    expect(report.attempted).toBe(50);
    expect(await outbox.pendingCount()).toBe(70);
  });

  it("drainAll empties a queue larger than one batch", async () => {
    await seed(120);
    const engine = new SyncEngine(outbox, new ScriptedPusher([]), clock, {
      ...DEFAULT_SYNC_OPTIONS,
      batchSize: 50,
    });

    const report = await engine.drainAll();

    expect(report.synced).toBe(120);
    expect(await outbox.pendingCount()).toBe(0);
  });

  it("drainAll gives up rather than spinning on a batch that never progresses", async () => {
    await seed(10);
    const engine = new SyncEngine(
      outbox,
      new ScriptedPusher(Array(50).fill({ type: "silent" })),
      clock,
    );

    const report = await engine.drainAll();

    expect(report.synced).toBe(0);
    expect(await outbox.pendingCount()).toBe(10);
  });

  it("collapses a timer tick that overlaps a manual Sync Now", async () => {
    await seed(3);
    const pusher = new ScriptedPusher([{ type: "accept-all" }]);
    const engine = new SyncEngine(outbox, pusher, clock);

    const [manual, timer] = await Promise.all([engine.drain(), engine.drain()]);

    // Exactly one push happened; the loser returned an empty report.
    expect(pusher.callCount).toBe(1);
    expect(manual.synced + timer.synced).toBe(3);
  });
});
