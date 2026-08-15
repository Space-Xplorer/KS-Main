import { createHmacKey } from "@/infra/crypto/hmac-signer";
import { createAdminClient } from "@/infra/supabase/server";
import { findCurrentEventId } from "@/infra/supabase/current-event";
import { cryptoIdGenerator } from "@/infra/ids/uuid-generator";
import { systemClock } from "@/infra/time/system-clock";
import { requireStaff } from "@/lib/require-staff";
import { createWalkinRegistration } from "@/core/registration/create-walkin";

/**
 * Real walk-in registration route (design doc §4.2), online — the desk's
 * offline-capable version comes later. Uses the same core
 * createWalkinRegistration() the offline path will use, so the two never
 * drift into producing differently-shaped registrations.
 *
 * Replaces /api/dev/issue's shared static key + client-supplied eventId with
 * requireStaff() + the server resolving the current event itself.
 */
export async function POST(request: Request): Promise<Response> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; email?: unknown; phone?: unknown; deviceId?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name : "";
  const email = typeof body?.email === "string" ? body.email : null;
  const phone = typeof body?.phone === "string" ? body.phone : null;
  const deviceId =
    typeof body?.deviceId === "string" && body.deviceId.length > 0
      ? body.deviceId
      : "unknown-device";

  const eventId = await findCurrentEventId();
  if (!eventId) {
    return Response.json({ error: "no event is currently open for registration" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: secretRow, error: secretError } = await admin
    .from("event_secrets")
    .select("signing_secret")
    .eq("event_id", eventId)
    .maybeSingle();

  if (secretError) return Response.json({ error: secretError.message }, { status: 500 });
  if (!secretRow) {
    return Response.json({ error: "no signing secret for this event" }, { status: 404 });
  }

  const signer = await createHmacKey(secretRow.signing_secret);
  const result = await createWalkinRegistration(
    { eventId, deviceId, name, email, phone },
    { signer, clock: systemClock, ids: cryptoIdGenerator },
  );

  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 400 });
  }

  const registration = result.registration;
  const { error: insertError } = await admin.from("registrations").insert({
    id: registration.registrationId,
    event_id: registration.eventId,
    guest_name: registration.name,
    guest_email: registration.email,
    guest_phone: registration.phone,
    source: "walkin",
    issued_by_device_id: registration.issuedByDeviceId,
    qr_token: registration.qrToken,
  });

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({
    registrationId: registration.registrationId,
    eventId: registration.eventId,
    name: registration.name,
    qrToken: registration.qrToken,
  });
}
