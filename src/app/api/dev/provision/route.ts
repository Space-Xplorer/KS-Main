import { createAdminClient } from "@/infra/supabase/server";
import { assertDevRouteAllowed } from "@/lib/dev-guard";

/** Matches supabase/seed.sql. The only event id this route will ever serve. */
const LOCAL_SEED_EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/**
 * Dev-harness route: hand a scanning device everything it needs before it
 * goes offline (design doc §4.4) — the event's signing secret and the current
 * registration list, so the scanner can verify AND tell "unknown" from
 * "forged" with zero network calls afterward.
 *
 * Pinned to the local seed event id, on top of assertDevRouteAllowed()'s
 * flag+key gate. This route's key is DEV_HARNESS_KEY's client-visible
 * counterpart (NEXT_PUBLIC_DEV_HARNESS_KEY) — it ships inside the browser
 * bundle by design, so it must never be able to hand out a REAL event's
 * signing secret even if ALLOW_DEV_HARNESS is accidentally left on somewhere
 * a real event exists. The real path is /api/checkins/provision, which uses
 * per-user staff auth instead of a shared key.
 */
export async function GET(request: Request): Promise<Response> {
  const guard = assertDevRouteAllowed(request);
  if (guard) return guard;

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId query param is required" }, { status: 400 });
  }
  if (eventId !== LOCAL_SEED_EVENT_ID) {
    return Response.json(
      { error: "this dev route only serves the local seed event; use /api/checkins/provision for real events" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const [{ data: secretRow, error: secretError }, { data: registrations, error: regError }] =
    await Promise.all([
      admin
        .from("event_secrets")
        .select("signing_secret")
        .eq("event_id", eventId)
        .maybeSingle(),
      admin
        .from("registrations")
        .select("id, guest_name, checked_in_at")
        .eq("event_id", eventId),
    ]);

  if (secretError) return Response.json({ error: secretError.message }, { status: 500 });
  if (regError) return Response.json({ error: regError.message }, { status: 500 });
  if (!secretRow) {
    return Response.json({ error: "no signing secret for this event" }, { status: 404 });
  }

  return Response.json({
    eventId,
    signingSecret: secretRow.signing_secret,
    registrations: (registrations ?? []).map((row) => ({
      registrationId: row.id,
      eventId,
      displayName: row.guest_name,
      checkedInAt: row.checked_in_at ? Date.parse(row.checked_in_at) : null,
    })),
  });
}
