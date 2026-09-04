-- ══════════════════════════════════════════════════════════════
-- Hospital plans: Clinic / Hospital / Multispecialist
-- ══════════════════════════════════════════════════════════════
-- Until now every vertical shared the same three generic plans (Starter/Pro/
-- Enterprise) seeded for the hotel product and never adapted for school or
-- hospital. The hospital vertical now gets its own commercial tiers, priced
-- and capped the way it's actually sold: by departments and rooms (the
-- "counters" figure in the price card), not branches and screens.
--
-- `plans.vertical` scopes a plan to one product. NULL means "any vertical" —
-- Starter/Pro/Enterprise stay NULL so the hotel and school pickers are
-- unaffected; only the hospital picker narrows to the three rows below.
--
-- `default_department_limit` / `default_counter_limit` seed a new hospital
-- customer's entitlement (customers.max_hospital_departments /
-- max_hospital_rooms, see 20260908_hospital_queue_system.sql) at creation
-- time, so picking a plan and picking a capacity are the same action instead
-- of two the distributor has to keep in sync by hand. They're read by
-- createCustomerAction; NULL for every non-hospital plan, where the
-- generic customer defaults already apply.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS vertical text,
  ADD COLUMN IF NOT EXISTS default_department_limit int,
  ADD COLUMN IF NOT EXISTS default_counter_limit int;

DO $$ BEGIN
  ALTER TABLE public.plans ADD CONSTRAINT plans_vertical_check
    CHECK (vertical IS NULL OR vertical IN ('business', 'school', 'hospital'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS plans_vertical_idx ON public.plans(vertical);

-- customers.max_hospital_departments/max_hospital_rooms (added in
-- 20260908_hospital_queue_system.sql) never got a guard rail matching the
-- school columns' customers_max_school_*_check. Add it now that a distributor
-- form writes these directly.
DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_max_hospital_departments_check
    CHECK (max_hospital_departments BETWEEN 0 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_max_hospital_rooms_check
    CHECK (max_hospital_rooms BETWEEN 0 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.plans
  (id, name, description,
   max_branches, max_screens_per_branch, max_daily_entries, storage_mb,
   allow_self_join, allow_analytics, allow_custom_display, allow_ads, allow_api_access, allow_sms,
   price_monthly, price_yearly, vertical, default_department_limit, default_counter_limit)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Clinic',
   'Small clinics and single-doctor practices.',
   1, 2, 2000, 500, true, true, false, false, false, false,
   2084, 25000, 'hospital', 2, 4),
  ('20000000-0000-0000-0000-000000000002', 'Hospital',
   'Mid-size hospitals with multiple departments.',
   1, 4, 10000, 2000, true, true, true, true, false, false,
   2917, 35000, 'hospital', 8, 15),
  ('20000000-0000-0000-0000-000000000003', 'Multispecialist',
   'Large multi-specialty hospitals and chains.',
   5, 8, 50000, 10000, true, true, true, true, true, true,
   5417, 65000, 'hospital', 30, 40)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  vertical = excluded.vertical,
  default_department_limit = excluded.default_department_limit,
  default_counter_limit = excluded.default_counter_limit,
  is_active = true,
  updated_at = now();

-- ── Move existing hospital tenants off the generic plans ──────
-- Every hospital customer today is on Starter/Pro/Enterprise (there was
-- nothing else to sell them). Move each to its nearest new tier and bring
-- their capacity in line with it, rather than leaving them on a plan the
-- hospital picker no longer offers.
UPDATE public.customers c
SET plan_id = '20000000-0000-0000-0000-000000000001',
    max_hospital_departments = 2,
    max_hospital_rooms = 4,
    updated_at = now()
FROM public.plans p
WHERE c.plan_id = p.id AND c.vertical = 'hospital' AND p.name = 'Starter';

UPDATE public.customers c
SET plan_id = '20000000-0000-0000-0000-000000000002',
    max_hospital_departments = 8,
    max_hospital_rooms = 15,
    updated_at = now()
FROM public.plans p
WHERE c.plan_id = p.id AND c.vertical = 'hospital' AND p.name = 'Pro';

UPDATE public.customers c
SET plan_id = '20000000-0000-0000-0000-000000000003',
    max_hospital_departments = 30,
    max_hospital_rooms = 40,
    updated_at = now()
FROM public.plans p
WHERE c.plan_id = p.id AND c.vertical = 'hospital' AND p.name = 'Enterprise';

-- Unredeemed hospital keys still pointing at a generic plan move too, so a
-- distributor never hands out a key labelled "Starter" for the hospital
-- system again.
UPDATE public.license_keys lk
SET plan_id = '20000000-0000-0000-0000-000000000001'
FROM public.plans p
WHERE lk.plan_id = p.id AND lk.vertical = 'hospital' AND lk.used_by IS NULL AND p.name = 'Starter';

UPDATE public.license_keys lk
SET plan_id = '20000000-0000-0000-0000-000000000002'
FROM public.plans p
WHERE lk.plan_id = p.id AND lk.vertical = 'hospital' AND lk.used_by IS NULL AND p.name = 'Pro';

UPDATE public.license_keys lk
SET plan_id = '20000000-0000-0000-0000-000000000003'
FROM public.plans p
WHERE lk.plan_id = p.id AND lk.vertical = 'hospital' AND lk.used_by IS NULL AND p.name = 'Enterprise';
