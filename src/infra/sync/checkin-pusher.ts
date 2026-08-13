import type { OutboxRecord, PushResult, RemotePusher } from "@/core/sync/outbox";

/** The shape stored in an outbox record's payload for kind "checkin". */
export interface CheckinPayload {
  readonly registrationId: string;
  readonly deviceId: string;
  /** Epoch ms. */
  readonly scannedAt: number;
}

/**
 * RemotePusher implementation for check-ins: posts a batch to
 * /api/checkins/sync. Network failure surfaces as a thrown error, which is
 * exactly what SyncEngine expects — it means "retry the whole batch later",
 * not "something is wrong with these records".
 */
export class CheckinPusher implements RemotePusher {
  async push(batch: readonly OutboxRecord[]): Promise<PushResult> {
    const checkins = batch.map((record) => {
      const payload = record.payload as CheckinPayload;
      return {
        id: record.id,
        registrationId: payload.registrationId,
        deviceId: payload.deviceId,
        scannedAt: payload.scannedAt,
      };
    });

    const response = await fetch("/api/checkins/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkins }),
    });

    if (!response.ok) {
      throw new Error(`sync failed: HTTP ${response.status}`);
    }

    return (await response.json()) as PushResult;
  }
}
