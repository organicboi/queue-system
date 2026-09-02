-- ══════════════════════════════════════════════════════════════
-- Public ticket tracking: QR on the printed ticket → live waiting page
-- ══════════════════════════════════════════════════════════════
-- The number printed on a ticket is only ever true at the instant it's
-- issued. This gives every school_tokens row a short, non-enumerable public
-- code and one RPC that answers "where do I stand right now" for it — the
-- server the printed QR points at.
--
-- Billable add-on, gated the same way school entitlements are
-- (20260901_school_entitlements.sql): a plain column on customers, set only
-- by the distributor. A second column on school_settings lets the school
-- itself turn its own grant off (e.g. no data plan expected in the lobby).
-- Effective = both true.
--
-- NOT mirrored into supabase/schema.sql — its opening `drop table … cascade`
-- would orphan this.
-- ══════════════════════════════════════════════════════════════


-- ── 1. Public code generator ────────────────────────────────────
-- 8 chars from a 30-symbol alphabet (~39 bits — not guessable by scanning
-- sequential codes) with the characters that get misread aloud at a counter
-- or mistyped by hand removed: 0/O, 1/I/L, U/V confusable pairs collapsed to
-- one. Drawn from gen_random_bytes, not random(): this is a capability
-- handle, not a display id.
--
-- search_path pins `extensions` alongside `public` because this runs as a
-- column DEFAULT from inside claim_school_token(), which is
-- `SET search_path = public` — without `extensions` on the path, pgcrypto's
-- gen_random_bytes() is invisible there and every token INSERT fails with
-- "function gen_random_bytes(integer) does not exist".
CREATE OR REPLACE FUNCTION public.gen_school_public_code() RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  len      int  := length(alphabet);
  code     text;
  i        int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, (get_byte(gen_random_bytes(1), 0) % len) + 1, 1);
    END LOOP;
    -- Collision odds at 8 chars/30 symbols are astronomically low; the retry
    -- loop exists so this is safe by construction rather than by odds.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.school_tokens WHERE public_code = code);
  END LOOP;
  RETURN code;
END;
$$;


-- ── 2. Column on school_tokens ──────────────────────────────────
ALTER TABLE public.school_tokens ADD COLUMN IF NOT EXISTS public_code text;

-- Unique index BEFORE the backfill: the generator's own collision check is a
-- seq scan without it, which turns backfilling an existing token table into
-- an O(n^2) migration.
CREATE UNIQUE INDEX IF NOT EXISTS school_tokens_public_code_uniq
  ON public.school_tokens(public_code);

UPDATE public.school_tokens
   SET public_code = public.gen_school_public_code()
 WHERE public_code IS NULL;

-- A column default (not an edit to claim_school_token) so every issuance
-- path — the kiosk RPC, staff walk-in, anything added later — gets a code
-- for free, with no way to forget one.
ALTER TABLE public.school_tokens ALTER COLUMN public_code SET DEFAULT public.gen_school_public_code();
ALTER TABLE public.school_tokens ALTER COLUMN public_code SET NOT NULL;


-- ── 3. The two gate columns ─────────────────────────────────────
-- Distributor grant defaults false — it's a sale, nobody gets it by
-- accident. School's own switch defaults true — once bought, it should just
-- work without an extra step.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS school_public_tracking_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS public_tracking_enabled boolean NOT NULL DEFAULT true;


-- ── 4. get_public_ticket_status ─────────────────────────────────
-- One round trip for the public page: gate check, ticket identity, live
-- position, now-serving, and an ETA range. SECURITY DEFINER + revoked from
-- PUBLIC like every other school RPC — reached only through
-- app/api/public/ticket/[code]/route.ts on the service-role client, never
-- directly with the anon/publishable key. That keeps this feature's traffic
-- funnelled through our own caching and error handling, exactly like every
-- other device surface in this schema.
CREATE OR REPLACE FUNCTION public.get_public_ticket_status(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token          public.school_tokens;
  v_dept           public.school_departments;
  v_branch         public.branches;
  v_customer       public.customers;
  v_settings       public.school_settings;
  v_counter        public.school_counters;
  v_today          date;
  v_is_today       boolean;
  v_enabled        boolean;
  v_waiting_ahead  int;
  v_now_serving    text;
  v_pace_count     int;
  v_pace_min       timestamptz;
  v_pace_max       timestamptz;
  v_avg_gap_secs   numeric;
  v_eta_secs       numeric;
BEGIN
  SELECT * INTO v_token FROM public.school_tokens WHERE public_code = p_code;
  IF v_token.id IS NULL THEN
    RETURN json_build_object('status', 'not-found');
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_token.customer_id;
  SELECT * INTO v_branch   FROM public.branches  WHERE id = v_token.branch_id;
  SELECT * INTO v_settings FROM public.school_settings WHERE branch_id = v_token.branch_id;
  SELECT * INTO v_dept     FROM public.school_departments WHERE id = v_token.department_id;

  IF NOT v_customer.is_active
     OR (v_customer.plan_expires_at IS NOT NULL AND v_customer.plan_expires_at < now()) THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  -- Effective gate: distributor grant AND the school's own switch. A branch
  -- with no settings row yet still defaults to on, matching the column
  -- default — nothing to configure before this works.
  v_enabled := coalesce(v_customer.school_public_tracking_enabled, false)
           AND coalesce(v_settings.public_tracking_enabled, true);

  IF NOT v_enabled THEN
    RETURN json_build_object('status', 'disabled');
  END IF;

  v_today    := public.school_service_date(v_token.branch_id);
  v_is_today := (v_token.service_date = v_today);

  -- Same predicate as countWaitingAhead() in lib/actions/school-tokens.ts —
  -- must never disagree with the number printed on the ticket.
  SELECT count(*) INTO v_waiting_ahead
    FROM public.school_tokens
   WHERE branch_id = v_token.branch_id
     AND department_id = v_token.department_id
     AND service_date = v_token.service_date
     AND status IN ('waiting', 'held')
     AND joined_at < v_token.joined_at;

  IF v_token.counter_id IS NOT NULL AND v_token.status = 'called' THEN
    SELECT * INTO v_counter FROM public.school_counters WHERE id = v_token.counter_id;
  END IF;

  -- What the department is calling right now, regardless of which counter.
  SELECT token_code INTO v_now_serving
    FROM public.school_tokens
   WHERE department_id = v_token.department_id
     AND service_date = v_token.service_date
     AND status = 'called'
   ORDER BY called_at DESC
   LIMIT 1;

  -- Pace: average gap between the last 10 calls in this department today.
  -- Throughput, not a per-visit service-time guess — what a visitor actually
  -- experiences across however many counters happen to be open.
  SELECT count(*), min(called_at), max(called_at)
    INTO v_pace_count, v_pace_min, v_pace_max
    FROM (
      SELECT called_at FROM public.school_tokens
       WHERE department_id = v_token.department_id
         AND service_date = v_token.service_date
         AND called_at IS NOT NULL
       ORDER BY called_at DESC
       LIMIT 10
    ) recent;

  IF v_pace_count >= 3 AND v_pace_max > v_pace_min THEN
    v_avg_gap_secs := extract(epoch FROM (v_pace_max - v_pace_min)) / (v_pace_count - 1);
  ELSE
    -- Not enough samples yet today — fall back to the branch's configured
    -- average service time rather than showing nothing.
    v_avg_gap_secs := coalesce(v_branch.avg_service_time, 5) * 60;
  END IF;

  v_eta_secs := v_waiting_ahead * v_avg_gap_secs;

  RETURN json_build_object(
    'status',            'ok',
    'schoolNameEn',      coalesce(nullif(v_settings.school_name_en, ''), v_customer.business_name),
    'schoolNameAr',      coalesce(v_settings.school_name_ar, ''),
    'logoUrl',           coalesce(nullif(v_settings.logo_url, ''), v_customer.logo_url),
    'languages',         coalesce(v_settings.languages, ARRAY['en']),
    'tokenCode',         v_token.token_code,
    'tokenStatus',       v_token.status,
    'isPriority',        v_token.is_priority,
    'joinedAt',          v_token.joined_at,
    'calledAt',          v_token.called_at,
    'departmentNameEn',  v_dept.name_en,
    'departmentNameAr',  v_dept.name_ar,
    'counterNameEn',     v_counter.name_en,
    'counterNameAr',     v_counter.name_ar,
    'serviceDate',       v_token.service_date,
    'isToday',           v_is_today,
    'waitingAhead',      v_waiting_ahead,
    'nowServingCode',    v_now_serving,
    'etaSeconds',        round(v_eta_secs),
    'paceSampleCount',   v_pace_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_ticket_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ticket_status(text) TO service_role;
