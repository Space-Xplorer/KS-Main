# KS-Main — working notes

Club platform for VNRVJIET Space Club. The current build target is the
QR-based attendance system: registration, QR issuance, and offline-capable
multi-lane check-in. Full spec in [docs/system-design.md](docs/system-design.md).

## The one constraint that shapes everything

Degraded connectivity **at the point of use**. Not "offline" in the abstract —
a crowd clustered at 2–3 entry lanes saturating the same cell towers, so mobile
data is worst exactly when load is highest.

Consequence: a scan must resolve with **zero network calls**. If you find
yourself adding an `await fetch(...)` to the check-in path, that is a design
error, not an implementation detail.

## Architecture — dependencies point inward

```
src/app/       Next.js routes             ─┐
src/features/  UI components + hooks      ─┤ may import anything below it
src/infra/     adapters: Supabase, crypto  ┤ may import core + lib
src/core/      pure domain                 ┘ imports nothing of ours
```

**`src/core/` is pure TypeScript.** No React, no Next, no Supabase, no Dexie,
no Node builtins, no `fetch`. It gets everything through ports defined in
[src/core/ports.ts](src/core/ports.ts).

This is enforced by `no-restricted-imports` in
[eslint.config.mjs](eslint.config.mjs) — violating it fails `npm run lint`.
Needing to break the rule means you want a new port, not an exception.

Why it matters: the domain suite runs in ~150 ms with no browser and no
database, and the token codec is shared unchanged between the server that
issues a QR and the phone that verifies it offline.

## Things that will bite you

**The token codec is signed input.** The wire format in
[src/core/tokens/codec.ts](src/core/tokens/codec.ts) is byte-for-byte stable by
contract. Changing field order, separators, or the timestamp unit without
bumping `QR_TOKEN_VERSION` invalidates every pass already issued.

**Postgres needs grants AND policies.** An RLS policy on a table with no
`SELECT` grant is inert — the query fails on privileges before RLS is
consulted. Both live in the init migration. Do not delete the grants section
assuming policies cover it.

**`event_secrets` has no grants to `anon` or `authenticated`, on purpose.**
Reading a signing secret fails on privileges, not merely on a missing policy.
Do not "fix" this by adding a grant.

**Duplicate check-in is resolved by a database trigger**, not application code.
`apply_checkin()` recomputes the whole group per registration on insert,
because records sync out of order — the scan that happened *first* may arrive
*last*, from a phone that had no signal until the event ended.

**Never delete a record from the outbox on failure.** It may be the only copy
of a check-in. Mark it retrying or rejected; both keep the row.

## Commands

```bash
npm run dev          # dev server
npm run verify       # typecheck + lint + test — run before pushing
npm test             # domain suite, no db/browser needed
npm run db:start     # local Supabase (needs Docker running)
npm run db:reset     # reapply migrations + seed
npm run db:types     # regenerate database.types.ts after a migration
```

`npm run db:types` must be re-run after every migration, or the typed client
will silently disagree with the real schema.

## Conventions

- Prefer a discriminated union (`{ ok: true } | { ok: false, reason }`) over
  throwing, for anything a volunteer could trigger at the gate. Losing signal
  is an expected state, not an exception.
- Failure messages in `src/core/` are written for a volunteer under pressure,
  not for a developer reading logs. See `TOKEN_ERROR_MESSAGE`.
- Inject `Clock` and `IdGenerator` rather than calling `Date.now()` or
  `crypto.randomUUID()` in domain code — that is what makes "earliest
  timestamp wins" testable without sleeping.

## History

A working Python/FastAPI prototype exists on `origin/chandu_branch`. It is not
merged — different stack, and online-only by construction. What to salvage from
it and what to avoid is written up in
[docs/reference/prototype-python-api.md](docs/reference/prototype-python-api.md).
