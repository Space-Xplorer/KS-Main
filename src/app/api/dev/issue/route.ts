import { createHmacKey } from "@/infra/crypto/hmac-signer";
import { createAdminClient } from "@/infra/supabase/server";
import { assertDevRouteAllowed } from "@/lib/dev-guard";
import { QR_TOKEN_VERSION } from "@/core/tokens/payload";
import { signToken } from "@/core/tokens/sign";

/** Matches supabase/seed.sql. The only event id this route will ever touch. */
const LOCAL_SEED_EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/**
 * Dev-harness route: issue one signed pass.
 *
 * Mirrors what the real walk-in desk will do (design doc §4.2), but online
 * and server-side rather than client-side-offline, because this exists to let
 * the SCANNER be tested before the walk-in desk UI is built.
 *
 * Pinned to the local seed event id — see /api/dev/provision for why. The
 * real path is /api/checkins/issue.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = assertDevRouteAllowed(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => null)) as
    | { eventId?: unknown; name?: unknown }
    | null;

  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!eventId || name.length === 0) {
    return Response.json({ error: "eventId and name are required" }, { status: 400 });
  }
  if (eventId !== LOCAL_SEED_EVENT_ID) {
    return Response.json(
      { error: "this dev route only serves the local seed event; use /api/checkins/issue for real events" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: secretRow, error: secretError } = await admin
    .from("event_secrets")
    .select("signing_secret")
    .eq("event_id", eventId)
    .maybeSingle();

  if (secretError) {
    return Response.json({ error: secretError.message }, { status: 500 });
  }
  if (!secretRow) {
    return Response.json({ error: "no signing secret for this event" }, { status: 404 });
  }

  const registrationId = crypto.randomUUID();
  const issuedAt = Date.now();
  const key = await createHmacKey(secretRow.signing_secret);

  const qrToken = await signToken(
    {
      version: QR_TOKEN_VERSION,
      eventId,
      registrationId,
      issuedBy: "dev-harness",
      issuedAt: Math.floor(issuedAt / 1000),
    },
    key,
  );

  if (qrToken === null) {
    return Response.json({ error: "failed to build token payload" }, { status: 500 });
  }

  const { error: insertError } = await admin.from("registrations").insert({
    id: registrationId,
    event_id: eventId,
    guest_name: name,
    source: "walkin",
    issued_by_device_id: "dev-harness",
    qr_token: qrToken,
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ registrationId, eventId, name, qrToken });
}
