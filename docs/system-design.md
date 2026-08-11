# Kakṣyā Śāstra — Club Platform System Design

**Prepared for:** VNRVJIET Space Club, MVP target = 3rd week of August 2026
**Status:** v2 — Phase 1 scope locked to the QR-based attendance system (registration + check-in), designed offline-first for venue conditions.

---

## 1. Confirmed Requirements

### Functional (full platform vision)
- **Public site** — club identity, events, achievements (SEO-visible, no login).
- **Member portal** — auth + role-based dashboard for actual club work.
- **Project/task management** — kanban-style boards so event/ops work doesn't die in WhatsApp scroll.
- **Resources (docs + finance)** — today it's loose Word/Excel files; needs a structured, linkable, role-gated home.
- **Event registration** — pre-registration online **and** on-site walk-in registration → unique QR issued per registrant.
- **Attendance** — 2–3 parallel scanning lanes at entry, real-time-ish check-in, duplicate-scan safe.
- **Notifications** — in-app feed to replace "150 unread WhatsApp messages, missed the important one."

### Phase 1 (current build target) — confirmed scope
Registration + QR issuance + Attendance scanning only. Task board, Resources, Notifications are deliberately deferred — not designed away, just not this sprint.

### Non-Functional — updated with the real constraint
- **Deadline**: functioning before the Aug 3rd-week event.
- **Solo-built now, team-maintained later.**
- **The actual hard constraint: degraded connectivity at the point of use.** Not "no internet" in the abstract — specifically, a crowd of people clustered at 2–3 entry lanes all pinging the same cell towers simultaneously, so mobile data degrades exactly when the system is under the most load. This is the design driver for Phase 1, more than raw traffic volume.
- **Multi-lane**: 2–3 scanning devices running in parallel at entry.
- **Walk-in registration**: some attendees will register on-site, at the venue, under the same degraded network — not just pre-registered attendees checking in.

### Explicit assumptions (flag if wrong)
- Hundreds of registrants, not thousands — designing for a college-scale event, not a stadium.
- "Degraded network" means slow/intermittent, not zero connectivity for the whole event — there will be brief windows (a data bar flickers back) worth exploiting for sync, even if no single window is reliable.
- Volunteer devices for scanning/walk-in desks are personal phones or a couple of club laptops — no dedicated hardware budget assumed.

---

## 2. Finalized Stack

| Layer | Choice | Why |
|---|---|---|
| Core app (public site, dashboards, admin) | **Next.js 15 (App Router) + TypeScript** | One repo, best-documented framework for AI-assisted solo dev speed and future student-team onboarding. |
| DB + Auth + Storage | **Supabase (managed Postgres)** | Relational data model, built-in auth + RLS for role permissions, no server ops for a rotating student team. |
| **Attendance + walk-in registration module** | **Separate offline-first PWA route**, same Next.js app but its own service-worker scope | This is the piece that actually needs engineering care — isolated so it doesn't inherit the weight of the rest of the portal, and loads fast on a bad connection *before* it even goes offline. |
| Offline local storage | **Dexie.js (IndexedDB wrapper)** | Every registration and check-in is written locally first, synced later. Dexie's API is far easier for a future student dev to reason about than raw IndexedDB. |
| Service worker / offline caching | **Workbox / `next-pwa`**, cache-first app shell | Precaches the scanner + walk-in-desk screens so they load instantly even on a bad connection at the gate. |
| QR generation | `qrcode` (npm) — **but signed, and generated client-side too** | See Section 4 — this is the key design change from v1. |
| QR scanning | `html5-qrcode` | Camera-based scan, validated **locally**, no network call required to authenticate a QR. |
| Sync strategy | **Manual + periodic + on-foreground**, NOT the Background Sync API | Background Sync is confirmed unreliable/unsupported on iOS Safari as of 2026 — real-world reports and current PWA guides agree it doesn't fire reliably, sometimes only syncing on next app open. Designing around a "Sync Now" button plus automatic retry on reconnect/foreground is the correct baseline for a mixed Android/iOS crowd, not a fallback. |
| Transactional email | **Resend** | Pre-registration confirmations only — walk-ins get their QR on-screen instantly, no email round-trip needed. |
| Hosting | **Vercel + Supabase Cloud** | Unchanged — zero server ops. |

---

## 3. Architecture — Where Offline-First Actually Lives

Only **two** of the six domain modules need to survive degraded connectivity: **Events & Registration** (for the walk-in path specifically) and **Attendance**. Everything else — Identity, Projects, Resources, Notifications — can assume normal connectivity, because nobody is doing project management standing in a crowd at the gate. Don't over-engineer offline support into modules that don't need it; that's SRP working in your favor on the timeline.

```
                    ONLINE-ASSUMED (normal connectivity)
        ┌─────────────┬──────────────┬───────────────┬──────────────┐
        ▼             ▼              ▼               ▼              ▼
  Identity &     Pre-registration  Projects &     Resources     Notifications
  Membership     (online form)     Tasks          (docs/finance)
        │             │              │               │              │
        └─────────────┴──────────────┴───────┬───────┴──────────────┘
                                              ▼
                                    Supabase (Postgres/Auth/Storage)


                 OFFLINE-FIRST (degraded connectivity at the venue)
        ┌───────────────────────────┐   ┌────────────────────────────┐
        │  Walk-in Registration Desk │   │   Attendance Scanner (×2-3) │
        │  (own PWA route)           │   │   (own PWA route)          │
        │                            │   │                            │
        │  • generates UUID +        │   │  • scans QR                │
        │    signed QR locally       │   │  • verifies signature      │
        │  • writes to IndexedDB     │   │    locally (no network)    │
        │  • shows QR on-screen      │   │  • checks local dup-cache  │
        │    instantly               │   │  • writes check-in to      │
        └─────────────┬──────────────┘   │    IndexedDB, instant UI   │
                       │                  └──────────────┬─────────────┘
                       │   opportunistic, idempotent batch sync
                       └────────────────┬─────────────────┘
                                        ▼
                              Supabase (reconciliation,
                              duplicate-flagging)
```

---

## 4. Offline-First Design — The Core of Phase 1

This is the part that determines whether the system actually works at the gate, so it gets worked through in detail.

### 4.1 Self-verifying QR tokens (no network call to authenticate)
Each QR encodes a compact signed token: `event_id + registration_id + issued_by (device_id or "online") + issued_at + HMAC-SHA256 signature`. The signing secret for that event is pushed to every scanning and walk-in device **during pre-event provisioning** (Section 4.4), while everyone still has good network. At scan time, the device recomputes the signature locally and compares — authenticity is verified with **zero network calls**. This is the single most important design decision here: it decouples "is this QR real" from "do I have signal right now."

*Security trade-off, named honestly:* the signing secret lives on volunteer devices, so a lost/compromised device could theoretically forge tokens for that one event. Mitigate by rotating the secret per event — never reuse across events or years. For a college club's risk profile, this is an acceptable trade for not needing a network call per scan.

### 4.2 Walk-in registration without ID collisions
Registration IDs are **client-generated UUIDs**, not server-assigned sequential IDs. This sidesteps the classic offline problem of two devices needing the "next" ID from a server they can't currently reach — no coordination needed, no pre-allocated ID ranges to manage. The walk-in desk generates the UUID, signs the token, and shows the QR on-screen immediately. Tell walk-in attendees to screenshot it on the spot — don't assume they'll have signal five minutes later to re-open anything.

### 4.3 Local-first write, opportunistic sync
Every registration (walk-in) and every check-in (scan) is written to that device's **IndexedDB first**, with instant UI feedback ("✅ Checked in" / "⚠️ Already checked in at 6:42 PM"), never waiting on a network round-trip. A small sync queue then pushes pending records to Supabase whenever a connection is available, via:
- a manual **"Sync Now"** button with a visible pending-count badge (so a volunteer isn't guessing whether it's working),
- automatic retry on the browser's `online` event,
- automatic retry when the tab/app comes back to the foreground,
- a periodic background timer (~20–30s) while the app is open.

All syncs are **idempotent batch upserts** keyed on `registration_id` / `checkin_id`, so a retried sync never double-writes.

### 4.4 Pre-event provisioning (this is a runbook, not just code)
30–60 minutes before doors open, every scanning and walk-in device connects to the best available network (venue wifi, or a hotspot someone brings specifically for this) and:
1. Pulls the full pre-registered attendee list + their QR tokens (for offline duplicate/validity checks),
2. Pulls the event's signing secret,
3. Lets the service worker precache the app shell.

Write this down as an actual checklist for whoever's running the door — it's an operational step your future tech team needs to know exists, not something the code can silently guarantee.

### 4.5 Conflict resolution across 2–3 lanes
With multiple offline lanes, it's possible (rare, but real) for the same person to be scanned at two lanes before either device has synced. Resolution rule: **earliest `checked_in_at` timestamp wins** on the server; the later attempt is stored as a flagged duplicate in a `checkin_events` audit table, not silently dropped — that record is genuinely useful afterward (e.g., someone tried to get a friend in on a screenshot of their QR). Be honest with yourself about the bound here: during the window between syncs, two lanes genuinely can't know about each other. Keep that window short through aggressive opportunistic syncing rather than pretending it can be eliminated to zero without real connectivity.

### 4.6 What this means for the data model
Beyond the v1 tables:
- `registrations` gains `source` (`online` | `walkin`), `issued_by_device_id`, `synced_at`.
- New table `checkin_events`: `id, registration_id, device_id, scanned_at, is_duplicate` — the audit trail that makes lane conflicts visible instead of silently resolved.
- An admin **reconciliation view**: synced vs. pending-sync counts per device, flagged duplicates — so after the event (or during a lull), someone can see at a glance whether any device never made it back online.

---

## 5. SOLID, Applied at System Level

| Principle | How it shows up here |
|---|---|
| **Single Responsibility** | Only Registration and Attendance carry offline complexity — Identity, Projects, Resources, Notifications stay simple and online-only. Don't let offline-handling logic leak into modules that don't need it. |
| **Open/Closed** | The sync layer is a generic "local-first, queue, batch-upsert" mechanism — reusable for Attendance and Walk-in Registration without either module knowing about the other. |
| **Liskov Substitution** | A `registration` record looks and behaves identically whether it came from the online form or the walk-in desk — same shape, same downstream handling, just a different `source` value. |
| **Interface Segregation** | Scanner devices and walk-in devices get distinct, minimal PWA routes — a scanner volunteer never sees registration-creation UI and vice versa. |
| **Dependency Inversion** | Scan-validation logic depends on a `TokenVerifier` interface, not directly on "HMAC + Web Crypto" — swappable later if the signing scheme changes, without touching the scanning UI. |

---

## 6. Core Data Model (v2)

| Table | Key fields |
|---|---|
| `users` | id, name, email, branch, year, joined_at |
| `roles` | member, project_lead, event_lead, finance_lead, docs_lead, admin |
| `events` | id, title, date, description, registration_open, signing_secret_ref |
| `registrations` | id (UUID), event_id, user_id/guest_info, qr_token (signed), **source** (online\|walkin), **issued_by_device_id**, **synced_at**, checked_in_at (nullable) |
| `checkin_events` | id, registration_id, device_id, scanned_at, is_duplicate |
| `projects` / `tasks` / `resources` / `notifications` | unchanged from v1 — deferred to later phases |

---

## 7. Traffic & Reliability

- **Pre-registration burst** (announcement moment, everyone on normal home/hostel wifi): Supabase connection pooling + rate-limiting on the registration endpoint, as before — this path isn't under the venue-congestion constraint.
- **At the venue**: the constraint isn't request volume, it's *degraded connectivity under load* — fully addressed by Section 4. This is the actual engineering risk for Phase 1, not server capacity.
- **Public pages**: static generation / ISR, unaffected by any of the above.

---

## 8. Phased Roadmap (updated)

| Phase | Scope |
|---|---|
| **1 — QR-Based Attendance System** *(current focus)* | (a) auth + event admin skeleton, (b) online pre-registration + QR issuance + email, (c) offline-capable walk-in registration desk, (d) offline-first multi-lane scanner with local validation + sync + conflict handling, (e) pre-event provisioning routine + admin reconciliation view |
| **2 — Internal coordination** *(deferred)* | Project/task board |
| **3 — Resources + Notifications** *(deferred)* | Docs/finance linking, in-app notification feed |
| **Post-event (Sept+)** | Hand off to dedicated tech team, revisit deferred phases, evaluate native finance module |

Everything in Phase 1 should get a real dry run — ideally a smaller internal event or a deliberate simulated-crowd test — before the actual August event, specifically to exercise the offline/sync path under real conditions, not just on office wifi.

---

## 9. What to Revisit as It Grows

- Once the dedicated tech team exists, add automated tests around the sync/conflict-resolution logic specifically — that's the highest-risk code in the system and the easiest to get subtly wrong.
- Re-evaluate whether a native app is worth it only if PWA camera/offline performance proves inadequate in practice — don't pre-optimize for that now.
- Revisit the signing-secret distribution approach if the club ever needs stronger security guarantees (e.g., ticketed paid events) — the current trade-off is sized for a college club's risk profile, not a commercial one.
