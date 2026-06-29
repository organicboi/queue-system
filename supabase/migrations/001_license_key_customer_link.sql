-- Migration 001: Link license keys to pre-created customers
-- Allows distributor to create customer + branch upfront and issue a key for client onboarding.
-- Backward-compatible: existing standalone keys have customer_id = NULL (old onboard flow still works).

alter table public.license_keys
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

create index if not exists idx_license_keys_customer on public.license_keys(customer_id);
