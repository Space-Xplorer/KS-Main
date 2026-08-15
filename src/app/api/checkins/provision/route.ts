import { createAdminClient } from "@/infra/supabase/server";
import { findCurrentEventId } from "@/infra/supabase/current-event";
import { requireStaff } from "@/lib/require-staff";

/**
 * Real provisioning route (design doc §4.4): hands a signed-in staff member's
 * device everything it needs before going offline — the event's signing
 * secret and the current registration list.
 *
 * Replaces /api/dev/provision's shared static key with a real per-user check:
 * requireStaff() reads the caller's session cookie, so there is no secret
 * embedded in client JS for someone to extract from devtools.
 */
export async function GET(): Promise<Response> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const eventId = await findCurrentEventId();
  if (!eventId) {
    return Response.json({ error: "no event is currently open for registration" }, { status: 404 });
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
