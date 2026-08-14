import { redirect } from "next/navigation";

import { createClient } from "@/infra/supabase/server";

import { Harness } from "./harness";

const SELF_PATH = "/dev/attendance";

/**
 * Server-side gate for the attendance dev harness.
 *
 * Two independent checks, both required:
 *   1. ALLOW_DEV_HARNESS — the existing deploy-wide opt-in flag (see
 *      src/lib/dev-guard.ts). Off by default on every environment, including
 *      Vercel previews, since NODE_ENV is always "production" there.
 *   2. A real signed-in user with a staff role (public.is_staff() — admin or
 *      event_lead). This is the new piece: before this, the harness was gated
 *      only by the shared flag above, which is not per-person and grants
 *      nothing role-specific. Now a volunteer needs an actual account.
 *
 * The heavy client logic (Dexie, camera, sync) stays in ./harness.tsx as a
 * separate "use client" component — this file's only job is the auth check.
 */
export default async function DevAttendancePage() {
  if (process.env.ALLOW_DEV_HARNESS !== "true") {
    return <p className="p-8 text-white">Not available.</p>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(SELF_PATH)}`);
  }

  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    redirect(`/login?next=${encodeURIComponent(SELF_PATH)}&error=not_staff`);
  }

  return <Harness />;
}
