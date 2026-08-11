import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/infra/supabase/database.types";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";

/**
 * Supabase client for server components and route handlers, acting as the
 * signed-in user. Still subject to RLS — this is the safe default.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies. Harmless when middleware
            // is refreshing the session, which is the usual arrangement.
          }
        },
      },
    },
  );
}

/**
 * Client that BYPASSES RLS entirely.
 *
 * Only for the narrow set of operations that genuinely cannot be expressed as
 * a user-scoped query: handing an event signing secret to a provisioning
 * device, and accepting synced batches from offline lanes.
 *
 * Rules: never import this from a "use client" file, and always check the
 * caller's identity yourself first — RLS is not going to do it for you here.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Deliberately inert: this client must never adopt a user session.
        },
      },
    },
  );
}
