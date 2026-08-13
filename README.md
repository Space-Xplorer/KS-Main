# KS-Main

Club platform for the **VNRVJIET Space Club** (Kakşyā Śāstra).

Current build target is the QR-based attendance system — online
pre-registration, on-site walk-in registration, and multi-lane check-in that
keeps working when the network at the venue does not.

## Why this is built the way it is

At the gate, a few hundred people cluster at 2–3 entry lanes and saturate the
same cell towers, so mobile data degrades exactly when the system is under the
most load. Everything below follows from that:

- **Passes verify offline.** Each QR carries an HMAC-signed token. A scanner
  recomputes the signature locally against the event secret it was provisioned
  with, so authenticity never depends on having signal.
- **Writes are local-first.** Registrations and check-ins go to IndexedDB
  immediately and sync opportunistically. The volunteer gets an answer in
  milliseconds; the network catches up later.
- **Ids are generated on the device.** Client-side UUIDs mean two walk-in desks
  can register people simultaneously, offline, and never collide.
- **Conflicts are resolved, not prevented.** Two lanes genuinely cannot know
  about each other while offline. The earliest scan wins; later ones are
  flagged as duplicates and kept as an audit trail.

Full design: [docs/system-design.md](docs/system-design.md).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + React 19 + TypeScript 6 |
| Database / auth | Supabase (Postgres, RLS) |
| Offline storage | IndexedDB via Dexie |
| QR signing | HMAC-SHA256 over WebCrypto |
| Tests | Vitest |

## Getting started

Requires **Node 22+** and **Docker** (for local Supabase).

```bash
npm install
cp .env.example .env.local

npm run db:start        # starts local Supabase, prints URL + keys
                        # paste those into .env.local
npm run db:reset        # apply migrations + seed data

npm run dev             # http://localhost:3000
```

`npm run db:start` prints the local API URL, anon key, and service role key —
use those for development rather than a cloud project.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run verify` | Typecheck + lint + test. Run before pushing. |
| `npm test` | Domain suite — no database or browser needed |
| `npm run db:reset` | Reapply migrations and seed |
| `npm run db:types` | Regenerate `database.types.ts` after a migration |

## Layout

```
src/core/     Pure domain. No framework, no IO. Lint-enforced.
src/infra/    Adapters: Supabase, WebCrypto, test fakes.
src/lib/      Validated environment and shared utilities.
src/app/      Next.js routes.
supabase/     Migrations and seed. The schema's source of truth.
tests/        Domain suite.
docs/         Design, runbooks, and prototype reference.
```

The layer boundaries are enforced by ESLint, not convention — `src/core/`
cannot import React, Next, Supabase or Dexie, and lint fails if it tries.
Architecture and conventions for contributors: [CLAUDE.md](CLAUDE.md).

## Running the door

Provisioning devices before an event is an operational step the code cannot
guarantee on its own:
[docs/runbooks/pre-event-provisioning.md](docs/runbooks/pre-event-provisioning.md).

## Status

Foundation and domain layer are complete and tested. UI, auth, and the sync
adapters are in progress — see [docs/system-design.md](docs/system-design.md) §8
for the phased roadmap.

## Licence

Apache 2.0 — see [LICENSE](LICENSE).
