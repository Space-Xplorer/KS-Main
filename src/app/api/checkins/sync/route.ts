import { createAdminClient } from "@/infra/supabase/server";
import { requireStaff } from "@/lib/require-staff";

/**
 * Accepts a batch of check-ins from an offline device.
 *
 * Idempotent on id (upsert, ignoreDuplicates): the sync engine on the device
 * replays a batch whenever it did not receive a clear synced/rejected answer,
 * so a record arriving twice must be a no-op, not a duplicate row. The
 * apply_checkin() trigger settles which scan actually wins per registration
 * (design doc §4.5) — this route's only job is to get rows in safely.
 *
 * requireStaff() matters here specifically: apply_checkin() picks the winner
 * by EARLIEST scanned_at, so an unauthenticated caller could otherwise inject
 * a fabricated early timestamp for someone else's registration id and get a
 * real check-in flagged as the duplicate. A signed-in scanner already carries
 * the session cookie needed for this check, so it costs the real flow nothing.
 */

interface IncomingCheckin {
  readonly id: string;
  readonly registrationId: string;
  readonly deviceId: string;
  /** Epoch ms. */
  readonly scannedAt: number;
}

export async function POST(request: Request): Promise<Response> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const body = (await request.json().catch(() => null)) as
    | { checkins?: unknown }
    | null;

  if (!Array.isArray(body?.checkins)) {
    return Response.json({ error: "checkins must be an array" }, { status: 400 });
  }

  const checkins = body.checkins as IncomingCheckin[];
  if (checkins.length === 0) {
    return Response.json({ syncedIds: [], rejectedIds: [] });
  }

  const admin = createAdminClient();

  const rows = checkins.map((c) => ({
    id: c.id,
    registration_id: c.registrationId,
    device_id: c.deviceId,
    scanned_at: new Date(c.scannedAt).toISOString(),
  }));

  const { error } = await admin
    .from("checkin_events")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    // Foreign key violation means the server has never heard of this
    // registration either — that is a permanent rejection, not a retry case.
    if (error.code === "23503") {
      return Response.json({
        syncedIds: [],
        rejectedIds: checkins.map((c) => ({ id: c.id, error: "unknown registration" })),
      });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    syncedIds: checkins.map((c) => c.id),
    rejectedIds: [],
  });
}
