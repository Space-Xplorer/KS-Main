/**
 * Guards the /api/dev/* routes.
 *
 * These routes exist so the offline attendance pipeline can be exercised
 * end-to-end before the real admin UI and device-auth flow are built. One of
 * them (provisioning) hands out an event's signing secret, which is exactly
 * the thing CLAUDE.md says must never be reachable without real auth.
 *
 * Gated on an explicit opt-in flag rather than `NODE_ENV`, deliberately:
 * Vercel sets NODE_ENV=production on every deployment it builds, including
 * previews, so a NODE_ENV check can never be reached on any Vercel URL. An
 * explicit flag means these routes stay off everywhere by default, but can be
 * switched on for one specific deployment — e.g. a preview build, to test
 * camera scanning on a real phone against a real URL — without touching code.
 */
export function assertDevRouteAllowed(request: Request): Response | null {
  if (process.env.ALLOW_DEV_HARNESS !== "true") {
    return Response.json(
      { error: "dev harness disabled (set ALLOW_DEV_HARNESS=true to enable)" },
      { status: 403 },
    );
  }

  const expected = process.env.DEV_HARNESS_KEY;
  if (!expected) {
    return Response.json(
      { error: "DEV_HARNESS_KEY is not set; refusing to run an unguarded dev route" },
      { status: 500 },
    );
  }

  if (request.headers.get("x-dev-harness-key") !== expected) {
    return Response.json({ error: "missing or wrong x-dev-harness-key" }, { status: 401 });
  }

  return null;
}
