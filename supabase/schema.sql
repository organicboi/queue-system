-- ============================================================
-- VibeQueue Pro — Supabase Schema
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Queue state: single-row table (always id = 1)
create table if not exists public.queue_state (
  id              int          primary key default 1,
  current_serving_number int   not null default 0,
  next_queue_number      int   not null default 1,
  updated_at      timestamptz  not null default now(),
  constraint single_row check (id = 1)
);

-- Seed the initial row
insert into public.queue_state (id, current_serving_number, next_queue_number)
values (1, 0, 1)
on conflict (id) do nothing;

-- 2. Queue entries
create table if not exists public.queue_entries (
  id              text         primary key,
  queue_number    int          not null unique,
  bill_number     text         not null,
  status          text         not null default 'waiting'
                               check (status in ('waiting', 'in-progress', 'completed', 'cancelled')),
  joined_at       timestamptz  not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  call_count      int          not null default 0,
  created_at      timestamptz  not null default now()
);

-- 3. Row Level Security — open policies for demo (tighten in production)
alter table public.queue_state   enable row level security;
alter table public.queue_entries enable row level security;

drop policy if exists "queue_state_all"   on public.queue_state;
drop policy if exists "queue_entries_all" on public.queue_entries;

create policy "queue_state_all"
  on public.queue_state for all
  using (true) with check (true);

create policy "queue_entries_all"
  on public.queue_entries for all
  using (true) with check (true);

-- 4. Enable Realtime on both tables
-- (Run these two lines separately if you get a "already a member" error)
alter publication supabase_realtime add table public.queue_state;
alter publication supabase_realtime add table public.queue_entries;
