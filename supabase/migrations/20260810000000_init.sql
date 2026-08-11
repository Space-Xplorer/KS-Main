-- Kakṣyā Śāstra — initial schema
--
-- Replaces the earlier prototype model (participants + attendance keyed on a
-- guessable "SWAP-1004" text id) with UUID-keyed registrations and a check-in
-- audit trail. Two properties are load-bearing:
--
--   1. Primary keys are CLIENT-generated UUIDs. That is what makes offline
--      sync idempotent — a retried batch upsert hits the same key and becomes
--      a no-op instead of creating a duplicate row.
--   2. Duplicate detection is done by a trigger, not by read-then-write in
--      application code. Two lanes scanning the same person simultaneously
--      cannot both observe "not yet checked in" and both insert.
--
-- RLS is enabled here, in the first migration, rather than added later once
-- the tables hold real attendee data.

create extension if not exists pgcrypto;

-- ============================================================================
-- Identity and roles
-- ============================================================================

create type public.app_role as enum (
  'member',
  'project_lead',
  'event_lead',
  'finance_lead',
  'docs_lead',
  'admin'
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text        not null,
  email      text        not null,
  branch     text,
  year       smallint,
  joined_at  timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid           not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz    not null default now(),
  primary key (user_id, role)
);

-- security definer so the policies below can read user_roles without needing a
-- policy on user_roles itself, which would otherwise recurse.
create function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = check_role
  );
$$;

-- "Staff" = anyone who may run an event door.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'event_lead')
  );
$$;

-- ============================================================================
-- Events
-- ============================================================================

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text        not null,
  description       text,
  starts_at         timestamptz not null,
  venue             text,
  registration_open boolean     not null default true,
  created_at        timestamptz not null default now()
);

-- Per-event HMAC secret for QR signing.
--
-- Deliberately NOT a column on events: any client that can read events could
-- then mint valid passes for any event. This table has RLS enabled and ZERO
-- policies, so anon and authenticated roles cannot touch it at all. Only the
-- service role reaches it, via the server-side provisioning route that hands
-- the secret to verified volunteer devices.
--
-- Rotate per event. Never reuse a secret across events or across years.
create table public.event_secrets (
  event_id       uuid primary key references public.events (id) on delete cascade,
  signing_secret text        not null,
  rotated_at     timestamptz not null default now()
);

-- ============================================================================
-- Registrations
-- ============================================================================

create type public.registration_source as enum ('online', 'walkin');

create table public.registrations (
  -- Client-generated. No DEFAULT: the device that created it owns the id, and
  -- that is precisely what removes the need to reach a server to allocate one.
  id                 uuid primary key,
  event_id           uuid not null references public.events (id) on delete cascade,

  -- Either a club member (user_id) or a guest captured at the desk.
  user_id            uuid references public.profiles (id) on delete set null,
  guest_name         text,
  guest_email        text,
  guest_phone        text,

  source             public.registration_source not null,
  issued_by_device_id text,
  qr_token           text        not null,

  checked_in_at      timestamptz,
  created_at         timestamptz not null default now(),
  synced_at          timestamptz not null default now(),

  constraint registrations_identity_present
    check (user_id is not null or guest_name is not null),

  -- A walk-in must record which desk issued it, or reconciliation cannot tell
  -- you which device never made it back online.
  constraint registrations_walkin_has_device
    check (source <> 'walkin' or issued_by_device_id is not null)
);

-- One registration per member per event. Partial, because guests have no user_id.
create unique index registrations_event_user_uniq
  on public.registrations (event_id, user_id)
  where user_id is not null;

create index registrations_event_idx on public.registrations (event_id);
create index registrations_pending_sync_idx
  on public.registrations (event_id, checked_in_at)
  where checked_in_at is null;

-- ============================================================================
-- Check-in audit trail
-- ============================================================================

-- Every scan lands here, including duplicates. Duplicates are flagged, never
-- dropped: "someone tried to get a friend in on a screenshot" is exactly the
-- thing you want visible afterward.
create table public.checkin_events (
  id              uuid primary key,           -- client-generated, idempotency key
  registration_id uuid        not null references public.registrations (id) on delete cascade,
  device_id       text        not null,
  scanned_at      timestamptz not null,
  is_duplicate    boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index checkin_events_registration_idx
  on public.checkin_events (registration_id, scanned_at);
create index checkin_events_device_idx on public.checkin_events (device_id);

/**
 * Settles cross-lane conflicts atomically (design doc §4.5).
 *
 * Mirrors resolveConflicts() in src/core/attendance/resolve-conflicts.ts:
 * earliest scanned_at wins, ties break on id, every other scan for that
 * registration is flagged duplicate.
 *
 * The whole group is recomputed on each insert rather than just the new row,
 * because records sync out of order — a scan that happened FIRST may arrive
 * LAST, from a lane whose phone had no signal until the event ended. Ordering
 * by scanned_at instead of arrival time is what makes the outcome independent
 * of sync order.
 */
create function public.apply_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_id uuid;
  earliest  timestamptz;
begin
  select id, scanned_at
    into winner_id, earliest
    from public.checkin_events
   where registration_id = new.registration_id
   order by scanned_at asc, id asc
   limit 1;

  update public.checkin_events
     set is_duplicate = (id <> winner_id)
   where registration_id = new.registration_id;

  update public.registrations
     set checked_in_at = earliest
   where id = new.registration_id;

  return null;
end;
$$;

create trigger checkin_events_apply
after insert on public.checkin_events
for each row execute function public.apply_checkin();

-- ============================================================================
-- Grants
--
-- Postgres needs BOTH a grant and a permissive RLS policy. A policy on a table
-- with no SELECT grant is inert — the query fails on privileges before RLS is
-- ever consulted. Do not delete this section on the assumption that the
-- policies below are doing the work by themselves.
--
-- Granted deliberately rather than with "grant all on all tables", so that
-- adding a future table does not silently expose it.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- The public site lists events without logging in.
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated; -- staff policy narrows

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.registrations to authenticated;
grant select, insert on public.checkin_events to authenticated;

-- event_secrets is deliberately absent: anon and authenticated get NOTHING, so
-- reading a signing secret fails on privileges, not merely on a missing policy.
-- This is the stronger of the two guarantees. Do not add a grant here.
grant select, insert, update, delete on public.event_secrets to service_role;

-- The trusted server identity. It bypasses RLS, but still needs the grant.
grant select, insert, update, delete on public.events         to service_role;
grant select, insert, update, delete on public.profiles       to service_role;
grant select, insert, update, delete on public.user_roles     to service_role;
grant select, insert, update, delete on public.registrations  to service_role;
grant select, insert, update, delete on public.checkin_events to service_role;

-- ============================================================================
-- Row Level Security
--
-- Note: the service role bypasses RLS entirely. These policies govern the
-- browser paths only. Offline devices sync through a server route rather than
-- writing directly, because they must be authenticated to receive the signing
-- secret anyway.
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.events         enable row level security;
alter table public.event_secrets  enable row level security;
alter table public.registrations  enable row level security;
alter table public.checkin_events enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_read_own on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

-- user_roles ----------------------------------------------------------------
create policy user_roles_read on public.user_roles
  for select using (user_id = auth.uid() or public.has_role('admin'));

create policy user_roles_admin_writes on public.user_roles
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- events --------------------------------------------------------------------
-- Public site lists events without login, so anon may read.
create policy events_public_read on public.events
  for select using (true);

create policy events_staff_write on public.events
  for all using (public.is_staff()) with check (public.is_staff());

-- event_secrets -------------------------------------------------------------
-- Intentionally NO policies. RLS on + no policy = deny all for anon and
-- authenticated. Reachable only by the service role. Do not "fix" this.

-- registrations -------------------------------------------------------------
create policy registrations_read_own on public.registrations
  for select using (user_id = auth.uid() or public.is_staff());

-- Online pre-registration by a signed-in member, only while the event is open.
create policy registrations_self_signup on public.registrations
  for insert with check (
    user_id = auth.uid()
    and source = 'online'
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.registration_open
    )
  );

create policy registrations_staff_write on public.registrations
  for all using (public.is_staff()) with check (public.is_staff());

-- checkin_events ------------------------------------------------------------
create policy checkin_events_staff_read on public.checkin_events
  for select using (public.is_staff());

create policy checkin_events_staff_insert on public.checkin_events
  for insert with check (public.is_staff());
