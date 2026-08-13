/**
 * Fetch helper for the /api/dev/* routes, shared by the harness page.
 *
 * Every call carries the shared dev key. This is fine only because
 * src/lib/dev-guard.ts refuses these routes outright in production — the key
 * itself is not a real secret, it just stops the endpoints being wide open on
 * a dev machine.
 */

const DEV_KEY = process.env.NEXT_PUBLIC_DEV_HARNESS_KEY ?? "";

export async function devFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      "x-dev-harness-key": DEV_KEY,
    },
  });
}

export class DevApiError extends Error {}

export async function devFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await devFetch(path, init);
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || !body) {
    throw new DevApiError(body?.error ?? `HTTP ${response.status}`);
  }
  return body;
}
