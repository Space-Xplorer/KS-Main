import { createAdminClient } from "@/infra/supabase/server";
import { assertDevRouteAllowed } from "@/lib/dev-guard";

/**
 * Dev-harness route: hand a scanning device everything it needs before it
 * goes offline (design doc §4.4) — the event's signing secret and the current
 * registration list, so the scanner can verify AND tell "unknown" from
 * "forged" with zero network calls afterward.
 */
export async function GET(request: Request): Promise<Response> {
  const guard = assertDevRouteAllowed(request);
  if (guard) return guard;

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId query param is required" }, { status: 400 });
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
