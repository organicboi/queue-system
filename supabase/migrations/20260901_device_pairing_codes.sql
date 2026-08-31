-- ══════════════════════════════════════════════════════════════
-- Device pairing codes  (short-lived 6-digit provisioning)
-- ══════════════════════════════════════════════════════════════
-- The kiosk tablet and the waiting-area TV are provisioned with an opaque
-- 48-char credential (branches.branch_token / screens.screen_token). Those
-- stay — they sit in the API path and are the only thing standing between a
-- stranger and a tenant's queue, so they must not shrink.
--
-- What shrinks is the thing a human types. The dashboard mints a 6-digit code
-- that maps to one branch (kiosk) or one screen (display) for a few minutes;
-- the device posts it once to /api/pair and gets the real long token back,
-- which it then stores locally and uses forever after. Standard smart-TV
-- pairing. A keyboard-less, camera-less TV never has to see the long string.
--
-- NOT mirrored into supabase/schema.sql — same reason as the school tables:
-- that file's opening `drop table … cascade` block would orphan it.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.device_pairing_codes (
  id           uuid        primary key default gen_random_uuid(),
  code         text        not null check (code ~ '^[0-9]{6}$'),
  customer_id  uuid        not null references public.customers(id) on delete cascade,
  branch_id    uuid        not null references public.branches(id) on delete cascade,
  role         text        not null check (role in ('kiosk','display')),
  -- Set for role='display' (which screen), null for role='kiosk'.
  screen_id    uuid        references public.screens(id) on delete cascade,
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  consumed_ip  text
);

-- A code string is unique only while it is still claimable. Once consumed (or
-- swept after expiry) the same six digits can be handed out again. The route
-- deletes expired rows before minting, so this stays small.
CREATE UNIQUE INDEX IF NOT EXISTS device_pairing_codes_live_code_idx
  ON public.device_pairing_codes (code)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS device_pairing_codes_target_idx
  ON public.device_pairing_codes (branch_id, role);

CREATE INDEX IF NOT EXISTS device_pairing_codes_expires_idx
  ON public.device_pairing_codes (expires_at);

-- RLS: service-role only, matching the school tables and `counters`. Every
-- read/write goes through the service client behind the requireX() guards
-- (dashboard) or the rate-limited /api/pair route (device).
ALTER TABLE public.device_pairing_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_pairing_codes_service_role_only ON public.device_pairing_codes;
CREATE POLICY device_pairing_codes_service_role_only
  ON public.device_pairing_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);
