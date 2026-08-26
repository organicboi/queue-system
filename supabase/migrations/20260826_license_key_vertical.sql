-- Which product a license key entitles its customer to.
--
-- Until now `customers.vertical` was read in four places but written in none:
-- onboarding always produced the column default ('business'), so the only way
-- to create a school tenant was a manual UPDATE. The choice belongs at the
-- point of sale instead — the distributor picks the system when issuing the
-- key, and onboardAction copies it onto the customer it creates.
--
-- 'business' is the hotel/restaurant queue product. The stored value is kept
-- as-is (it is the column default on customers and is already constrained
-- there); the distributor UI labels it "Hotel Queue System".

ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'business';

DO $$ BEGIN
  ALTER TABLE public.license_keys ADD CONSTRAINT license_keys_vertical_check
    CHECK (vertical IN ('business', 'school'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keys the distributor pre-linked to a customer must agree with that customer,
-- otherwise redeeming one would silently re-vertical a tenant that already has
-- rows in the other product's tables.
UPDATE public.license_keys lk
   SET vertical = c.vertical
  FROM public.customers c
 WHERE lk.customer_id = c.id
   AND lk.vertical IS DISTINCT FROM c.vertical;

CREATE INDEX IF NOT EXISTS license_keys_vertical_idx
  ON public.license_keys(vertical);
