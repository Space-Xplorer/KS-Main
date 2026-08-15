import { redirect } from "next/navigation";

import { createClient } from "@/infra/supabase/server";

import { Scanner } from "./scanner-client";

const SELF_PATH = "/scanner";

/**
 * The real attendance scanner. Always on for a signed-in staff account — no
 * env flag, unlike /dev/attendance (which stays a separate, deliberately
 * gated test tool; see src/lib/dev-guard.ts).
 *
 * Auth is a real Supabase session + public.is_staff() role, checked
 * server-side, same as /dev/attendance/page.tsx.
 */
export default async function ScannerPage() {
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

  return <Scanner />;
}
