import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/infra/supabase/database.types";
import { clientEnv } from "@/lib/env";

/**
 * Supabase client for the browser.
 *
 * Uses the anon key, so every query is subject to the grants and RLS policies
 * in supabase/migrations/. Safe to ship to the client — which is exactly why
 * those policies exist from the first migration rather than being added later.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
