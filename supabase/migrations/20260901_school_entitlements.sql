-- ══════════════════════════════════════════════════════════════
-- School entitlements: departments & counters are sold, not free
-- ══════════════════════════════════════════════════════════════
-- Until now a school tenant could add unlimited departments and counters from
-- /school/departments and /school/counters. Both are billable capacity (each
-- counter is a staffed window with its own console link; each department is a
-- token series on the kiosk and the TV), so the ceiling moves to the
-- distributor: they assign the numbers, the tenant spends them.
--
-- Per BRANCH, not per customer — matching plans.max_screens_per_branch. A
-- multi-campus tenant gets the same allowance at each campus rather than a
-- shared pool that one campus could drain.
--
-- Quotas count ACTIVE rows only. Departments and counters are never hard
-- deleted (school_tokens references them), so deactivating is how a tenant
-- frees a slot to spend elsewhere.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS max_school_departments int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_school_counters    int NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_max_school_departments_check
    CHECK (max_school_departments BETWEEN 0 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_max_school_counters_check
    CHECK (max_school_counters BETWEEN 0 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── Backfill: nobody loses what they already run ──────────────
-- The default of 1 would put every existing school instantly over quota (the
-- onboarding flow seeds 8 departments). Grant each tenant its current
-- high-water mark across its branches; the distributor can lower it later.
UPDATE public.customers c
SET max_school_departments = GREATEST(c.max_school_departments, u.peak)
FROM (
  SELECT customer_id, MAX(per_branch) AS peak
  FROM (
    SELECT customer_id, branch_id, count(*) AS per_branch
    FROM public.school_departments
    WHERE is_active
    GROUP BY customer_id, branch_id
  ) b
  GROUP BY customer_id
) u
WHERE u.customer_id = c.id;

UPDATE public.customers c
SET max_school_counters = GREATEST(c.max_school_counters, u.peak)
FROM (
  SELECT customer_id, MAX(per_branch) AS peak
  FROM (
    SELECT customer_id, branch_id, count(*) AS per_branch
    FROM public.school_counters
    WHERE is_active
    GROUP BY customer_id, branch_id
  ) b
  GROUP BY customer_id
) u
WHERE u.customer_id = c.id;
