-- ============================================================
-- Queue System — Multi-Tenant SaaS Schema
-- Distributor → Plans → Customers → Branches → Screens
-- Run entire file in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ── EXTENSIONS ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── DROP OLD TABLES (clean slate) ─────────────────────────────
drop table if exists public.activity_logs cascade;
drop table if exists public.queue_entries cascade;
drop table if exists public.queue_state cascade;
drop table if exists public.screen_ads cascade;
drop table if exists public.screens cascade;
drop table if exists public.user_branches cascade;
drop table if exists public.branches cascade;
drop table if exists public.profiles cascade;
drop table if exists public.license_keys cascade;
drop table if exists public.customers cascade;
drop table if exists public.plans cascade;
drop table if exists public.ads cascade;
drop table if exists public.ticker_messages cascade;
drop table if exists public.businesses cascade;

-- ── 1. PLANS ──────────────────────────────────────────────────
create table public.plans (
  id                       uuid        primary key default gen_random_uuid(),
  name                     text        not null,
  description              text        not null default '',
  max_branches             int         not null default 1,
  max_screens_per_branch   int         not null default 2,
  max_daily_entries        int         not null default 500,
  storage_mb               int         not null default 100,
  allow_self_join          boolean     not null default true,
  allow_analytics          boolean     not null default true,
  allow_custom_display     boolean     not null default false,
  allow_ads                boolean     not null default false,
  allow_api_access         boolean     not null default false,
  allow_sms                boolean     not null default false,
  price_monthly            numeric(10,2) not null default 0,
  price_yearly             numeric(10,2) not null default 0,
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── 2. CUSTOMERS ──────────────────────────────────────────────
create table public.customers (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  business_name    text        not null default '',
  slug             text        unique,
  logo_url         text        not null default '',
  primary_color    text        not null default '#0F172A',
  secondary_color  text        not null default '#6366F1',
  phone            text        not null default '',
  email            text        not null default '',
  address          text        not null default '',
  plan_id          uuid        references public.plans(id) on delete restrict,
  plan_expires_at  timestamptz,
  is_active        boolean     not null default true,
  branch_ad_mode   text        not null default 'append'
                               check (branch_ad_mode in ('replace','prepend','append')),
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 3. LICENSE KEYS ───────────────────────────────────────────
create table public.license_keys (
  id          uuid        primary key default gen_random_uuid(),
  key         text        not null unique default encode(gen_random_bytes(16), 'hex'),
  plan_id     uuid        not null references public.plans(id) on delete restrict,
  used_by     uuid        references public.customers(id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz,
  notes       text        not null default '',
  created_at  timestamptz not null default now()
);

-- ── 4. PROFILES ───────────────────────────────────────────────
create table public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  customer_id  uuid        not null references public.customers(id) on delete cascade,
  email        text        not null,
  full_name    text        not null default '',
  role         text        not null default 'branch_user'
                           check (role in ('admin','branch_user')),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_profiles_customer on public.profiles(customer_id);
create index idx_profiles_email on public.profiles(email);

-- ── 5. BRANCHES ───────────────────────────────────────────────
create table public.branches (
  id               uuid        primary key default gen_random_uuid(),
  customer_id      uuid        not null references public.customers(id) on delete cascade,
  name             text        not null,
  location_note    text        not null default '',
  branch_token     text        not null unique default encode(gen_random_bytes(24), 'hex'),
  queue_label      text        not null default 'Queue Number',
  allow_self_join  boolean     not null default true,
  max_capacity     int         not null default 100,
  avg_service_time int         not null default 5,
  sound_enabled    boolean     not null default true,
  silent_print     boolean     not null default false,
  printer_name     text        not null default '',
  ticker_text      text        not null default '',
  counter_presence_enabled boolean not null default false,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_branches_customer on public.branches(customer_id);
create index idx_branches_token on public.branches(branch_token);

-- ── 6. USER_BRANCHES ──────────────────────────────────────────
create table public.user_branches (
  id           uuid        primary key default gen_random_uuid(),
  customer_id  uuid        not null references public.customers(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  branch_id    uuid        not null references public.branches(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint user_branches_unique unique(user_id, branch_id)
);

create index idx_user_branches_user on public.user_branches(user_id);
create index idx_user_branches_branch on public.user_branches(branch_id);
create index idx_user_branches_customer on public.user_branches(customer_id);

-- ── 7. SCREENS ────────────────────────────────────────────────
create table public.screens (
  id                   uuid        primary key default gen_random_uuid(),
  customer_id          uuid        not null references public.customers(id) on delete cascade,
  branch_id            uuid        not null references public.branches(id) on delete cascade,
  name                 text        not null default 'Display Screen',
  screen_token         text        not null unique default encode(gen_random_bytes(24), 'hex'),
  orientation          text        not null default 'landscape'
                                   check (orientation in ('landscape','portrait')),
  layout               text        check (layout in ('split-standard','rates-wide','rates-full','ads-full','portrait')),
  theme                text        check (theme in ('standard','dark','vibrant','minimal')),
  show_ads             boolean,
  show_ticker          boolean,
  show_clock           boolean     not null default true,
  show_estimated_wait  boolean     not null default true,
  numbers_to_show      int         not null default 5,
  announcement_lang    text        not null default 'en'
                                   check (announcement_lang in ('en','ar','both')),
  is_active            boolean     not null default true,
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_screens_branch on public.screens(branch_id);
create index idx_screens_customer on public.screens(customer_id);
create index idx_screens_token on public.screens(screen_token);

-- ── 8. QUEUE STATE ────────────────────────────────────────────
create table public.queue_state (
  id                       uuid        primary key default gen_random_uuid(),
  customer_id              uuid        not null references public.customers(id) on delete cascade,
  branch_id                uuid        not null references public.branches(id) on delete cascade,
  current_serving_number   int         not null default 0,
  next_queue_number        int         not null default 1,
  is_paused                boolean     not null default false,
  updated_at               timestamptz not null default now(),
  constraint queue_state_branch_unique unique(branch_id)
);

create index idx_queue_state_customer on public.queue_state(customer_id);
create index idx_queue_state_branch on public.queue_state(branch_id);

-- ── 9. QUEUE ENTRIES ──────────────────────────────────────────
create table public.queue_entries (
  id             uuid        primary key default gen_random_uuid(),
  customer_id    uuid        not null references public.customers(id) on delete cascade,
  branch_id      uuid        not null references public.branches(id) on delete cascade,
  queue_number   int         not null,
  bill_number    text        not null,
  customer_name  text        not null default '',
  phone          text        not null default '',
  status         text        not null default 'waiting'
                             check (status in ('waiting','in-progress','completed','cancelled','no-show')),
  source         text        not null default 'admin'
                             check (source in ('admin','self-join','kiosk','api')),
  joined_at      timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  call_count     int         not null default 0,
  recall_count   int         not null default 0,
  notes          text        not null default '',
  created_at     timestamptz not null default now(),
  constraint queue_entries_branch_number unique(branch_id, queue_number)
);

create index idx_queue_entries_branch_status on public.queue_entries(branch_id, status);
create index idx_queue_entries_branch_created on public.queue_entries(branch_id, created_at desc);
create index idx_queue_entries_customer on public.queue_entries(customer_id);

-- ── 10. ACTIVITY LOGS (insert-only) ───────────────────────────
create table public.activity_logs (
  id            uuid        primary key default gen_random_uuid(),
  customer_id   uuid        not null references public.customers(id) on delete cascade,
  branch_id     uuid        not null references public.branches(id) on delete cascade,
  entry_id      uuid        references public.queue_entries(id) on delete set null,
  performed_by  uuid        references public.profiles(id) on delete set null,
  source        text        not null default 'admin'
                            check (source in ('admin','kiosk','self-join','system')),
  type          text        not null
                            check (type in ('joined','called','recalled','completed','cancelled','no-show','reset','paused','resumed','kitchen-bypassed')),
  queue_number  int         not null default 0,
  bill_number   text        not null default '',
  message       text        not null default '',
  created_at    timestamptz not null default now()
);

create index idx_activity_logs_branch_created on public.activity_logs(branch_id, created_at desc);
create index idx_activity_logs_customer on public.activity_logs(customer_id);

-- ── 11. ADS ───────────────────────────────────────────────────
create table public.ads (
  id                uuid        primary key default gen_random_uuid(),
  customer_id       uuid        not null references public.customers(id) on delete cascade,
  branch_id         uuid        references public.branches(id) on delete cascade,
  name              text        not null default '',
  file_url          text        not null default '',
  file_type         text        not null default 'image'
                                check (file_type in ('image','video')),
  file_size_bytes   bigint      not null default 0,
  duration_seconds  int         not null default 8,
  display_order     int         not null default 0,
  is_active         boolean     not null default true,
  audio_enabled     boolean     not null default false,
  placement         text        not null default 'side'
                                check (placement in ('side','fullscreen')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_ads_customer on public.ads(customer_id);
create index idx_ads_branch on public.ads(branch_id);

-- ── 12. SCREEN ADS ────────────────────────────────────────────
create table public.screen_ads (
  id             uuid        primary key default gen_random_uuid(),
  customer_id    uuid        not null references public.customers(id) on delete cascade,
  screen_id      uuid        not null references public.screens(id) on delete cascade,
  ad_id          uuid        not null references public.ads(id) on delete cascade,
  display_order  int         not null default 0,
  created_at     timestamptz not null default now(),
  constraint screen_ads_unique unique(screen_id, ad_id)
);

create index idx_screen_ads_screen on public.screen_ads(screen_id);
create index idx_screen_ads_customer on public.screen_ads(customer_id);

-- ── 13. TICKER MESSAGES ───────────────────────────────────────
create table public.ticker_messages (
  id             uuid        primary key default gen_random_uuid(),
  customer_id    uuid        not null references public.customers(id) on delete cascade,
  branch_id      uuid        references public.branches(id) on delete cascade,
  message        text        not null,
  display_order  int         not null default 0,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now()
);

create index idx_ticker_customer on public.ticker_messages(customer_id);
create index idx_ticker_branch on public.ticker_messages(branch_id);

-- ══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- ── claim_queue_number ────────────────────────────────────────
create or replace function public.claim_queue_number(p_branch_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_number integer;
begin
  update public.queue_state
     set next_queue_number = next_queue_number + 1,
         updated_at = now()
   where branch_id = p_branch_id
   returning next_queue_number - 1 into v_number;

  if v_number is null then
    raise exception 'Queue state not found for branch %', p_branch_id;
  end if;

  return v_number;
end;
$$;

-- ── check_branch_quota ────────────────────────────────────────
create or replace function public.check_branch_quota(p_customer_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_current_count int;
  v_max_branches  int;
begin
  select count(*) into v_current_count
    from public.branches
   where customer_id = p_customer_id and is_active = true;

  select p.max_branches into v_max_branches
    from public.plans p
    join public.customers c on c.plan_id = p.id
   where c.id = p_customer_id;

  return v_current_count < coalesce(v_max_branches, 1);
end;
$$;

-- ── resolve_screen_settings ───────────────────────────────────
create or replace function public.resolve_screen_settings(p_screen_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_screen   record;
  v_result   json;
begin
  select
    coalesce(s.layout, 'split-standard')   as layout,
    coalesce(s.theme, 'standard')           as theme,
    coalesce(s.show_ads, true)             as show_ads,
    coalesce(s.show_ticker, true)          as show_ticker,
    s.show_clock,
    s.show_estimated_wait,
    s.numbers_to_show,
    s.orientation,
    coalesce(s.announcement_lang, 'en')    as announcement_lang
  into v_screen
  from public.screens s
  where s.id = p_screen_id;

  if not found then
    return null;
  end if;

  select row_to_json(v_screen) into v_result;
  return v_result;
end;
$$;

-- ── get_screen_data ───────────────────────────────────────────
create or replace function public.get_screen_data(p_screen_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_screen    record;
  v_branch    record;
  v_customer  record;
  v_plan      record;
  v_state     record;
  v_entries   json;
  v_ads       json;
  v_tickers   json;
  v_settings  json;
  v_today     date := current_date;
begin
  -- Resolve screen
  select s.* into v_screen
    from public.screens s
   where s.screen_token = p_screen_token and s.is_active = true;

  if not found then
    return json_build_object('status', 'not_configured');
  end if;

  -- Update last_seen_at
  update public.screens set last_seen_at = now() where id = v_screen.id;

  -- Resolve branch
  select b.* into v_branch
    from public.branches b
   where b.id = v_screen.branch_id;

  -- Resolve customer
  select c.* into v_customer
    from public.customers c
   where c.id = v_screen.customer_id;

  -- Resolve plan
  select p.* into v_plan
    from public.plans p
   where p.id = v_customer.plan_id;

  -- Check subscription
  if not v_customer.is_active or (v_customer.plan_expires_at is not null and v_customer.plan_expires_at < now()) then
    return json_build_object(
      'status', 'expired',
      'businessName', v_customer.business_name,
      'primaryColor', v_customer.primary_color,
      'logoUrl', v_customer.logo_url
    );
  end if;

  -- Queue state
  select * into v_state
    from public.queue_state
   where branch_id = v_branch.id;

  -- Today's active entries
  select json_agg(e order by e.queue_number asc) into v_entries
    from public.queue_entries e
   where e.branch_id = v_branch.id
     and e.status in ('waiting', 'in-progress')
     and date(e.joined_at) = v_today;

  -- Resolve ads (screen override wins; else branch+customer merge)
  declare
    v_screen_ad_count int;
  begin
    select count(*) into v_screen_ad_count
      from public.screen_ads sa
     where sa.screen_id = v_screen.id;

    if v_screen_ad_count > 0 then
      select json_agg(a order by sa.display_order asc) into v_ads
        from public.screen_ads sa
        join public.ads a on a.id = sa.ad_id
       where sa.screen_id = v_screen.id and a.is_active = true;
    else
      declare
        v_branch_ads json;
        v_customer_ads json;
      begin
        select json_agg(a order by a.display_order) into v_branch_ads
          from public.ads a
         where a.branch_id = v_branch.id and a.is_active = true;

        select json_agg(a order by a.display_order) into v_customer_ads
          from public.ads a
         where a.customer_id = v_customer.id and a.branch_id is null and a.is_active = true;

        if v_branch_ads is null then
          v_ads := v_customer_ads;
        elsif v_customer_ads is null then
          v_ads := v_branch_ads;
        else
          case v_customer.branch_ad_mode
            when 'replace'  then v_ads := v_branch_ads;
            when 'prepend'  then v_ads := (select json_agg(x) from (select * from json_array_elements(v_branch_ads) union all select * from json_array_elements(v_customer_ads)) x);
            else                 v_ads := (select json_agg(x) from (select * from json_array_elements(v_customer_ads) union all select * from json_array_elements(v_branch_ads)) x);
          end case;
        end if;
      end;
    end if;
  end;

  -- Ticker messages (branch-specific first, then customer-wide)
  select json_agg(t order by t.display_order) into v_tickers
    from public.ticker_messages t
   where t.is_active = true
     and (t.branch_id = v_branch.id or (t.branch_id is null and t.customer_id = v_customer.id));

  -- Resolve settings
  v_settings := resolve_screen_settings(v_screen.id);

  return json_build_object(
    'status',               'ok',
    'screenId',             v_screen.id,
    'screenName',           v_screen.name,
    'branchId',             v_branch.id,
    'branchName',           v_branch.name,
    'customerId',           v_customer.id,
    'businessName',         v_customer.business_name,
    'primaryColor',         v_customer.primary_color,
    'secondaryColor',       v_customer.secondary_color,
    'logoUrl',              v_customer.logo_url,
    'queueLabel',           v_branch.queue_label,
    'tickerText',           v_branch.ticker_text,
    'currentServingNumber', coalesce(v_state.current_serving_number, 0),
    'isPaused',             coalesce(v_state.is_paused, false),
    'entries',              coalesce(v_entries, '[]'::json),
    'ads',                  coalesce(v_ads, '[]'::json),
    'tickers',              coalesce(v_tickers, '[]'::json),
    'settings',             v_settings,
    'allowSelfJoin',        v_branch.allow_self_join,
    'planName',             v_plan.name
  );
end;
$$;

-- ── get_branch_data ───────────────────────────────────────────
create or replace function public.get_branch_data(p_branch_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_branch   record;
  v_customer record;
  v_plan     record;
  v_state    record;
begin
  select b.* into v_branch
    from public.branches b
   where b.branch_token = p_branch_token and b.is_active = true;

  if not found then
    return json_build_object('status', 'not_configured');
  end if;

  select c.* into v_customer
    from public.customers c
   where c.id = v_branch.customer_id;

  select p.* into v_plan
    from public.plans p
   where p.id = v_customer.plan_id;

  if not v_customer.is_active or (v_customer.plan_expires_at is not null and v_customer.plan_expires_at < now()) then
    return json_build_object('status', 'expired', 'businessName', v_customer.business_name);
  end if;

  select * into v_state from public.queue_state where branch_id = v_branch.id;

  return json_build_object(
    'status',               'ok',
    'branchId',             v_branch.id,
    'branchName',           v_branch.name,
    'branchToken',          v_branch.branch_token,
    'customerId',           v_customer.id,
    'businessName',         v_customer.business_name,
    'primaryColor',         v_customer.primary_color,
    'logoUrl',              v_customer.logo_url,
    'queueLabel',           v_branch.queue_label,
    'allowSelfJoin',        v_branch.allow_self_join,
    'maxCapacity',          v_branch.max_capacity,
    'avgServiceTime',       v_branch.avg_service_time,
    'soundEnabled',         v_branch.sound_enabled,
    'silentPrint',          v_branch.silent_print,
    'printerName',          v_branch.printer_name,
    'tickerText',           v_branch.ticker_text,
    'currentServingNumber', coalesce(v_state.current_serving_number, 0),
    'isPaused',             coalesce(v_state.is_paused, false),
    'planName',             v_plan.name,
    'allowAds',             v_plan.allow_ads,
    'allowAnalytics',       v_plan.allow_analytics
  );
end;
$$;

-- ── get_distributor_stats ─────────────────────────────────────
create or replace function public.get_distributor_stats()
returns json
language plpgsql
security definer
as $$
declare
  v_total_customers  int;
  v_active_customers int;
  v_total_branches   int;
  v_entries_today    int;
begin
  select count(*) into v_total_customers from public.customers;
  select count(*) into v_active_customers from public.customers where is_active = true;
  select count(*) into v_total_branches from public.branches where is_active = true;
  select count(*) into v_entries_today from public.queue_entries where date(created_at) = current_date;

  return json_build_object(
    'totalCustomers',  v_total_customers,
    'activeCustomers', v_active_customers,
    'totalBranches',   v_total_branches,
    'entriesToday',    v_entries_today
  );
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

alter table public.plans            enable row level security;
alter table public.customers        enable row level security;
alter table public.license_keys     enable row level security;
alter table public.profiles         enable row level security;
alter table public.branches         enable row level security;
alter table public.user_branches    enable row level security;
alter table public.screens          enable row level security;
alter table public.queue_state      enable row level security;
alter table public.queue_entries    enable row level security;
alter table public.activity_logs    enable row level security;
alter table public.ads              enable row level security;
alter table public.screen_ads       enable row level security;
alter table public.ticker_messages  enable row level security;

-- plans: public read
create policy "plans_read_all" on public.plans for select using (true);

-- customers: own tenant only
create policy "customers_read_own" on public.customers for select
  using (id in (select customer_id from public.profiles where id = auth.uid()));
create policy "customers_update_admin" on public.customers for update
  using (id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- license_keys: unused keys readable (for onboarding validation)
create policy "license_keys_read_unused" on public.license_keys for select using (used_by is null);

-- profiles: own + admin sees all in same tenant
create policy "profiles_read_own_tenant" on public.profiles for select
  using (id = auth.uid() or customer_id in (
    select customer_id from public.profiles where id = auth.uid() and role = 'admin'
  ));
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "profiles_insert_service" on public.profiles for insert with check (true);

-- branches: own tenant
create policy "branches_read_own" on public.branches for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "branches_write_admin" on public.branches for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- user_branches: own tenant
create policy "user_branches_read_own" on public.user_branches for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "user_branches_write_admin" on public.user_branches for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- screens: own tenant
create policy "screens_read_own" on public.screens for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "screens_write_admin" on public.screens for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- queue_state: public read (TV display); authenticated write
create policy "queue_state_read_all" on public.queue_state for select using (true);
create policy "queue_state_update_auth" on public.queue_state for update
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));

-- queue_entries: public read + insert (self-join); authenticated update
create policy "queue_entries_read_all" on public.queue_entries for select using (true);
create policy "queue_entries_insert_all" on public.queue_entries for insert with check (true);
create policy "queue_entries_update_auth" on public.queue_entries for update
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));

-- activity_logs: own tenant read; insert for own tenant or self-join source
create policy "activity_logs_read_own" on public.activity_logs for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "activity_logs_insert_own" on public.activity_logs for insert
  with check (
    customer_id in (select customer_id from public.profiles where id = auth.uid())
    or source = 'self-join'
  );

-- ads: own tenant
create policy "ads_read_own" on public.ads for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "ads_write_admin" on public.ads for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- screen_ads: admin only
create policy "screen_ads_admin" on public.screen_ads for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- ticker_messages: own tenant
create policy "ticker_read_own" on public.ticker_messages for select
  using (customer_id in (select customer_id from public.profiles where id = auth.uid()));
create policy "ticker_write_admin" on public.ticker_messages for all
  using (customer_id in (select customer_id from public.profiles where id = auth.uid() and role = 'admin'));

-- ══════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.queue_state;
alter publication supabase_realtime add table public.queue_entries;
alter publication supabase_realtime add table public.activity_logs;

-- ══════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════

-- Seed plans
insert into public.plans (id, name, description, max_branches, max_screens_per_branch, max_daily_entries, storage_mb, allow_self_join, allow_analytics, allow_custom_display, allow_ads, allow_api_access, allow_sms, price_monthly, price_yearly)
values
  ('10000000-0000-0000-0000-000000000001', 'Starter',    'Single location, basic queue management',              1,  2,   200,  100,  true,  false, false, false, false, false, 0,     0),
  ('10000000-0000-0000-0000-000000000002', 'Pro',        'Up to 5 branches, analytics, custom displays & ads',  5,  5,  1000,  500,  true,  true,  true,  true,  false, false, 29.99, 299.99),
  ('10000000-0000-0000-0000-000000000003', 'Enterprise', 'Unlimited scale, API access, SMS notifications',     50, 20, 10000, 5000,  true,  true,  true,  true,  true,  true,  99.99, 999.99)
on conflict (id) do nothing;

-- Demo license keys
insert into public.license_keys (id, key, plan_id, notes)
values
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'STARTER-DEMO-2024', '10000000-0000-0000-0000-000000000001', 'Demo Starter key'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'PRO-DEMO-2024',     '10000000-0000-0000-0000-000000000002', 'Demo Pro key'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'ENT-DEMO-2024',     '10000000-0000-0000-0000-000000000003', 'Demo Enterprise key')
on conflict (id) do nothing;

-- ── DONE ──────────────────────────────────────────────────────
-- After running:
-- 1. Use /onboard page with license key (e.g. PRO-DEMO-2024) to create your first customer
-- 2. Log in at /login with the email/password you set during onboarding
-- 3. Or use /distributor/login with DISTRIBUTOR_SECRET env var for platform management
