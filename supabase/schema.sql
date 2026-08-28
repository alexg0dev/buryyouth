-- Save Our Youth schema
-- Apply to the active project (SQL editor or MCP apply_migration / execute_sql).
--
-- Dashboard (not SQL):
--   Authentication → Providers → Email → Confirm email = ON
--   Authentication → URL Configuration:
--     Site URL: https://saveburyyouth.com
--     Redirect URLs: https://saveburyyouth.com/login.html,
--       https://saveburyyouth.com/**, http://localhost:*/login.html,
--       http://127.0.0.1:*/login.html
--   Optional: Authentication → Emails → custom SMTP if built-in mail is delayed.

create extension if not exists pgcrypto;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Anonymous',
  email text not null default '',
  area text not null default '',
  topic text not null default 'General',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.joins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  cause text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_when text not null default '',
  event_where text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Anonymous',
  amount text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  town text,
  date_of_birth date,
  under_18 boolean,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists town text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists under_18 boolean;

alter table public.profiles drop constraint if exists profiles_town_check;
alter table public.profiles add constraint profiles_town_check
  check (
    town is null
    or town in ('Radcliffe', 'Tottington', 'Bury', 'Ramsbottom', 'Whitefield')
  );

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id text not null,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_key)
);

alter table public.issues enable row level security;
alter table public.joins enable row level security;
alter table public.updates enable row level security;
alter table public.events enable row level security;
alter table public.donations enable row level security;
alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.votes enable row level security;

drop policy if exists "issues_select" on public.issues;
drop policy if exists "joins_select" on public.joins;
drop policy if exists "updates_select" on public.updates;
drop policy if exists "events_select" on public.events;
drop policy if exists "donations_select" on public.donations;
drop policy if exists "polls_select" on public.polls;
drop policy if exists "votes_select" on public.votes;
drop policy if exists "issues_insert" on public.issues;
drop policy if exists "issues_update" on public.issues;
drop policy if exists "issues_delete" on public.issues;
drop policy if exists "joins_insert" on public.joins;
drop policy if exists "joins_delete" on public.joins;
drop policy if exists "updates_insert" on public.updates;
drop policy if exists "updates_update" on public.updates;
drop policy if exists "updates_delete" on public.updates;
drop policy if exists "events_insert" on public.events;
drop policy if exists "events_update" on public.events;
drop policy if exists "events_delete" on public.events;
drop policy if exists "donations_insert" on public.donations;
drop policy if exists "donations_update" on public.donations;
drop policy if exists "donations_delete" on public.donations;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_delete" on public.profiles;
drop policy if exists "polls_insert" on public.polls;
drop policy if exists "polls_update" on public.polls;
drop policy if exists "polls_delete" on public.polls;

-- Public read
create policy "issues_select" on public.issues for select to anon, authenticated using (true);
create policy "joins_select" on public.joins for select to anon, authenticated using (true);
create policy "updates_select" on public.updates for select to anon, authenticated using (true);
create policy "events_select" on public.events for select to anon, authenticated using (true);
create policy "donations_select" on public.donations for select to anon, authenticated using (true);
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "polls_select" on public.polls for select to anon, authenticated using (true);
create policy "votes_select" on public.votes for select to anon, authenticated using (true);

-- Directory without date of birth (for admin contact list)
create or replace view public.profiles_directory as
  select id, email, town, created_at from public.profiles;

grant select on public.profiles_directory to anon, authenticated;

-- Public write (site forms + simple admin password gate in the frontend)
create policy "issues_insert" on public.issues for insert to anon, authenticated with check (true);
create policy "issues_update" on public.issues for update to anon, authenticated using (true) with check (true);
create policy "issues_delete" on public.issues for delete to anon, authenticated using (true);

create policy "joins_insert" on public.joins for insert to anon, authenticated with check (true);
create policy "joins_delete" on public.joins for delete to anon, authenticated using (true);

create policy "updates_insert" on public.updates for insert to anon, authenticated with check (true);
create policy "updates_update" on public.updates for update to anon, authenticated using (true) with check (true);
create policy "updates_delete" on public.updates for delete to anon, authenticated using (true);

create policy "events_insert" on public.events for insert to anon, authenticated with check (true);
create policy "events_update" on public.events for update to anon, authenticated using (true) with check (true);
create policy "events_delete" on public.events for delete to anon, authenticated using (true);

create policy "donations_insert" on public.donations for insert to anon, authenticated with check (true);
create policy "donations_update" on public.donations for update to anon, authenticated using (true) with check (true);
create policy "donations_delete" on public.donations for delete to anon, authenticated using (true);

create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete" on public.profiles for delete to anon, authenticated using (true);

create policy "polls_insert" on public.polls for insert to anon, authenticated with check (true);
create policy "polls_update" on public.polls for update to anon, authenticated using (true) with check (true);
create policy "polls_delete" on public.polls for delete to anon, authenticated using (true);

-- Votes are inserted only by the Railway server (service role), after
-- checking the session, Bury town, and under_18 on the profile.
drop policy if exists "votes_insert" on public.votes;

-- Votes are stored here. Logged-in eligible users vote with voter_key = auth.uid().

-- Seed default poll
insert into public.polls (question, options, active)
select
  'What should be prioritised for Bury''s youth?',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Safer streets & transport'),
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Mental health support'),
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'More youth spaces & activities'),
    jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Jobs, skills & opportunities')
  ),
  true
where not exists (select 1 from public.polls);

insert into public.updates (title, body)
select 'Public transport safety', 'Looking into antisocial behaviour on buses and other public transport around Bury.'
where not exists (select 1 from public.updates);

insert into public.events (title, event_when, event_where, body)
select 'More events soon', 'Dates to be announced', 'Bury', 'Campaign meet-ups and protest details will be posted here.'
where not exists (select 1 from public.events);
