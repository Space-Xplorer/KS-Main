-- Local development seed. Runs on `npm run db:reset`.
-- Never contains real attendee data or a real signing secret.

insert into public.events (id, title, description, starts_at, venue, registration_open)
values (
  '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  'Kakşyā Śāstra — Dry Run',
  'Local development event. Use this id when testing the scanner.',
  now() + interval '7 days',
  'VNRVJIET Campus',
  true
);

-- Development-only signing secret. The real one is generated per event during
-- provisioning and never committed.
insert into public.event_secrets (event_id, signing_secret)
values (
  '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  'dev-only-signing-secret-do-not-use-in-production'
);
