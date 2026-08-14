import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { clientEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every request.
 *
 * (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` — same
 * mechanism, new name. See node_modules/next/dist/docs/.../file-conventions/proxy.md.)
 *
 * Without this, an access token silently expires (~1hr) and nothing forces a
 * refresh until the user hits a server action, which mid-event looks like a
 * volunteer getting logged out at the gate for no visible reason. This is the
 * standard @supabase/ssr pattern: read+write cookies through the response so
 * the refreshed token round-trips back to the browser.
 *
 * This does NOT enforce authorization (who may see what) — that stays as a
 * real check in each protected page/route, close to the data it guards.
 * Proxy only keeps the session itself alive.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touches the session so an expiring token gets refreshed as a side effect.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation, which
     * never carry a session and would just add pointless cookie churn.
     */
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png).*)",
  ],
};
