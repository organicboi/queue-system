-- Counter access system
-- Each counter has a unique token; accessing /counter/<token> loads its dashboard.
-- Admin can activate/deactivate or revoke (regenerate token) at any time.

create table if not exists counters (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  branch_id      uuid not null references branches(id)  on delete cascade,
  name           text not null,
  type           text not null check (type in ('billing', 'kitchen', 'delivery')),
  counter_token  text not null unique default gen_random_uuid()::text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists counters_branch_id_idx      on counters(branch_id);
create index if not exists counters_customer_id_idx    on counters(customer_id);
create index if not exists counters_counter_token_idx  on counters(counter_token);

-- RLS: service role only (counter actions bypass RLS via service client)
alter table counters enable row level security;

create policy "service role full access"
  on counters for all
  using (true)
  with check (true);
