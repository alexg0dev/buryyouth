-- Save Our Youth schema
-- Run on your Supabase project (SQL editor) if MCP cannot create a project due to free-tier limits.

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
alter table public.polls enable row level security;
alter table public.votes enable row level security;

-- Public read
create policy "issues_select" on public.issues for select to anon, authenticated using (true);
create policy "joins_select" on public.joins for select to anon, authenticated using (true);
create policy "updates_select" on public.updates for select to anon, authenticated using (true);
create policy "events_select" on public.events for select to anon, authenticated using (true);
create policy "donations_select" on public.donations for select to anon, authenticated using (true);
create policy "polls_select" on public.polls for select to anon, authenticated using (true);
create policy "votes_select" on public.votes for select to anon, authenticated using (true);

-- Public write (site forms + simple admin password gate in the frontend)
create policy "issues_insert" on public.issues for insert to anon, authenticated with check (true);
create policy "issues_update" on public.issues for update to anon, authenticated using (true) with check (true);
create policy "issues_delete" on public.issues for delete to anon, authenticated using (true);

create policy "joins_insert" on public.joins for insert to anon, authenticated with check (true);
create policy "joins_delete" on public.joins for delete to anon, authenticated using (true);

create policy "updates_insert" on public.updates for insert to anon, authenticated with check (true);
create policy "updates_delete" on public.updates for delete to anon, authenticated using (true);

create policy "events_insert" on public.events for insert to anon, authenticated with check (true);
create policy "events_delete" on public.events for delete to anon, authenticated using (true);

create policy "donations_insert" on public.donations for insert to anon, authenticated with check (true);
create policy "donations_delete" on public.donations for delete to anon, authenticated using (true);

create policy "polls_insert" on public.polls for insert to anon, authenticated with check (true);
create policy "polls_update" on public.polls for update to anon, authenticated using (true) with check (true);
create policy "polls_delete" on public.polls for delete to anon, authenticated using (true);

create policy "votes_insert" on public.votes for insert to anon, authenticated with check (true);

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
