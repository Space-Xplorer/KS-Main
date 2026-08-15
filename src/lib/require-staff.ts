import { createClient } from "@/infra/supabase/server";

/**
 * Real per-user auth gate for the production check-in routes.
 *
 * This replaces the shared static key the /api/dev/* routes use
 * (src/lib/dev-guard.ts): instead of "anyone holding one key", it is "a
 * signed-in Supabase user with a staff role" (public.is_staff() — admin or
 * event_lead), checked server-side from the request's session cookie.
 */
export async function requireStaff(): Promise<
  { readonly ok: true } | { readonly ok: false; readonly response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: Response.json({ error: "not signed in" }, { status: 401 }) };
  }

  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error) {
    return { ok: false, response: Response.json({ error: error.message }, { status: 500 }) };
  }
  if (!isStaff) {
    return { ok: false, response: Response.json({ error: "not a staff account" }, { status: 403 }) };
  }

  return { ok: true };
}
