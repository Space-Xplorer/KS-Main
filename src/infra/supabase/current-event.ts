import { createAdminClient } from "@/infra/supabase/server";

/**
 * Resolves the event the check-in routes operate on, instead of a hardcoded
 * id in client code. Picks the open event starting soonest — correct for a
 * single-event club. If Kakşyā Śāstra ever runs two events with overlapping
 * registration windows, this needs a real event picker instead.
 */
export async function findCurrentEventId(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id")
    .eq("registration_open", true)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
