# Runbook — Deploying to Vercel + Supabase Cloud

**Who this is for:** whoever is taking the site live.
**When:** once the content on `main` is ready to be public.
**Why it exists:** deployment touches a real database and a real domain —
worth having a checklist rather than reconstructing the steps from memory
each time. See also [CLAUDE.md](../../CLAUDE.md) for the architecture this
sits on top of.

---

## What actually gets deployed

Only two things need to be reachable on the internet:

1. **The marketing site** (`/`) — fully static, no database calls at all.
2. **The scanner's provisioning and sync endpoints** (`/api/checkins/sync`
   and, once built, a real (authenticated) provisioning route) — these need
   Supabase.

**QR generation, the CSV import from the Google Form export, and sending
email do NOT get deployed.** That runs as a local script on an organiser's
machine, talking to Supabase directly with the service-role key. Vercel never
sees that key used for bulk writes, and Vercel functions never risk timing
out on a batch email send. See `scripts/` once that script exists.

The `/dev/attendance` harness and its `/api/dev/*` routes are test-only and
**stay off by default everywhere**, including on Vercel — see
`src/lib/dev-guard.ts`. The real path for staff is `/login` → `/scanner`,
backed by `/api/checkins/provision`, `/api/checkins/issue` and
`/api/checkins/sync` — all gated by a real signed-in staff account
(`src/lib/require-staff.ts`), not a shared key. `/api/dev/*` additionally
refuses to serve any event other than the local seed event, so leaving
`ALLOW_DEV_HARNESS` on somewhere by mistake cannot leak a real signing
secret.

---

## 1. Supabase Cloud project

- [x] Project created — `ltrxivotfcgebawthszq`.
- [x] Schema pushed (`supabase db push`).
- [x] Real Celestra event + a freshly generated signing secret created.
- [ ] Note the three values from **Project Settings → API**:
      - Project URL
      - anon / publishable key (safe to expose client-side — RLS protects it)
      - **service_role / secret key** (never expose this client-side, ever)
- [ ] Push the schema:
      ```bash
      supabase login                              # opens a browser once
      supabase link --project-ref ltrxivotfcgebawthszq
      supabase db push                             # applies supabase/migrations/*
      ```
      This applies migrations only. `supabase/seed.sql` is **not** pushed —
      it only runs locally via `db reset`, and it must never run against this
      project (it contains a placeholder signing secret and fake event).
- [ ] Confirm grants + RLS landed: open Supabase Studio → Table Editor, check
      `event_secrets` has RLS enabled and **no policies** — `anon` and
      `authenticated` should get a permission error querying it, not an empty
      result. (See CLAUDE.md — a table with RLS on and no grant fails on
      privileges, before RLS is even consulted; both are required.)
- [ ] Create the real event manually (Table Editor or SQL editor) — an
      `events` row for Celestra, and a matching `event_secrets` row with a
      **freshly generated** signing secret, not a copy of the local dev one.
      There is no admin UI for this yet.

## 2. Vercel project

- [ ] Connect the GitHub repo to a new Vercel project. Framework preset:
      Next.js (auto-detected). No build command changes needed.
- [ ] Set environment variables — **Project Settings → Environment Variables**:

  | Variable | Value | Environments |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | the Supabase Cloud project URL | All |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/publishable key | All |
  | `SUPABASE_SERVICE_ROLE_KEY` | the service_role/secret key | All |
  | `ALLOW_DEV_HARNESS` | leave unset, or `false` | All (Production especially) |
  | `NEXT_PUBLIC_ALLOW_DEV_HARNESS` | leave unset, or `false` | All (Production especially) |

  `RESEND_API_KEY` / `EMAIL_FROM` are not needed — email is a local script,
  not a deployed route (see above).

- [ ] Deploy. Vercel builds with `next build`, same as running it locally.
- [ ] **Do not force-push a stale `main` or roll back a live deployment**
      without checking what registrations/check-ins have already synced —
      the app is fine, but this is a reminder that Vercel deploys are cheap,
      the underlying Supabase data is not.

## 3. Verify the live deployment

- [ ] Load the production URL. Check the hero, the schedule, and that all
      poster images load (they are static files under `/posters`, so this
      also confirms the build included `public/`).
- [ ] Click "Register" from three places (header, hero, an event card) —
      confirm each opens the Google Form in a **new tab**.
- [ ] `curl -i https://<domain>/dev/attendance` — expect **"Not available."**
      in the body. If you see the actual harness UI, `ALLOW_DEV_HARNESS`/
      `NEXT_PUBLIC_ALLOW_DEV_HARNESS` are set somewhere they should not be —
      fix this before telling anyone the URL.
- [ ] `curl -i https://<domain>/api/dev/provision?eventId=x` — expect
      `403` with `"dev harness disabled"`. Same reasoning as above.
- [ ] Run Lighthouse or check DevTools' Network tab on a throttled
      connection — the whole point of this site's design is that it stays
      usable on bad venue wifi; confirm it actually does before the event.

---

## What is deliberately not ready yet

Being explicit about this so "it's deployed" doesn't get read as "it's
finished":

- **Staff login exists (`/login`), but no admin UI.** Creating an event and
  its signing secret is still a manual Supabase Studio/script step (§1
  above), and staff accounts are provisioned directly in `user_roles` — there
  is no "create event" or "invite a volunteer" form in the app yet.
- **`/scanner` is one combined screen**, not the separate walk-in-desk and
  scanner routes the system design describes. Functionally complete (real
  auth, real signed tokens, real offline-first sync) but not visually
  differentiated by role yet.
- **No offline app-shell precaching (service worker).** The scanner needs a
  network connection for its *first* load; everything after that load works
  offline. Provision on good network before doors open (see
  `pre-event-provisioning.md`).
- **No email sending yet.** The local script that generates QR codes and
  emails them is the next piece of work, not yet built.
- **No admin reconciliation view.** Checking that every device synced is a
  manual Supabase Studio query for now, not a dashboard.
