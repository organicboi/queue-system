-- ══════════════════════════════════════════════════════════════
-- School content strings → jsonb locale maps  (Region rollout, Phase 2)
-- ══════════════════════════════════════════════════════════════
-- The paired `_en` / `_ar` columns only ever hold two languages. India needs
-- en/mr/hi, and the two Supabase projects must keep an identical schema, so
-- each translatable string moves to ONE jsonb column holding {"en": "...",
-- "ar": "...", "mr": "..."} — read with public.loc(col, locale).
--
-- BACKWARD-COMPATIBLE on purpose. The old `_en` / `_ar` columns are KEPT and
-- kept in sync by every write path, and the RPCs below emit BOTH the new maps
-- and the legacy scalar keys. This lets the live Gulf web app and the
-- separately-released Flutter kiosk keep working unchanged until they are on
-- the new shape. The column drop is a later migration
-- (20260905_school_content_locale_cleanup.sql) — DO NOT run it until every
-- client is updated.
--
-- A fresh India project is stood up from supabase/setup-fresh-db.sql, which
-- already carries the jsonb columns AND the legacy ones, so it can run this
-- migration as a no-op or skip it.
--
-- NOT mirrored into supabase/schema.sql (its opening `drop table` would orphan
-- the school product).
-- ══════════════════════════════════════════════════════════════


-- ── 1. Locale accessor ─────────────────────────────────────────
-- coalesce(map ->> locale, map ->> 'en', ''): the requested language, then
-- English (always present — enforced by the CHECKs below), then empty rather
-- than NULL so callers never have to guard.
CREATE OR REPLACE FUNCTION public.loc(p_val jsonb, p_locale text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_val ->> p_locale, p_val ->> 'en', '')
$$;


-- ── 2. Add the jsonb columns ───────────────────────────────────
-- `{}` is the "not yet backfilled" sentinel §3 keys off; §5 swaps in the real
-- default once every existing row is filled.
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS school_name       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_footer     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS announce_template jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.school_departments
  ADD COLUMN IF NOT EXISTS name jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.school_counters
  ADD COLUMN IF NOT EXISTS name jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ── 3. Backfill from the legacy columns ────────────────────────
-- jsonb_strip_nulls drops an absent/empty secondary; the 'en' key is then
-- forced on so the CHECK can rely on it (a legacy row with an empty name_en
-- gets {"en": ""}, which is fine — loc() still returns ''). Guarded so a
-- re-run, or a row already partly migrated, is left alone.
UPDATE public.school_settings
   SET school_name = jsonb_strip_nulls(
         jsonb_build_object('en', school_name_en, 'ar', nullif(school_name_ar, '')))
                     || jsonb_build_object('en', coalesce(school_name_en, ''))
 WHERE school_name = '{}'::jsonb OR NOT (school_name ? 'en');

UPDATE public.school_settings
   SET ticket_footer = jsonb_strip_nulls(
         jsonb_build_object('en', nullif(ticket_footer_en, ''), 'ar', nullif(ticket_footer_ar, '')))
                       || jsonb_build_object('en', coalesce(ticket_footer_en, ''))
 WHERE ticket_footer = '{}'::jsonb OR NOT (ticket_footer ? 'en');

UPDATE public.school_settings
   SET announce_template = jsonb_strip_nulls(
         jsonb_build_object('en', nullif(announce_template_en, ''), 'ar', nullif(announce_template_ar, '')))
                           || jsonb_build_object('en', coalesce(nullif(announce_template_en, ''),
                                'Token {token}, please proceed to {counter}'))
 WHERE announce_template = '{}'::jsonb OR NOT (announce_template ? 'en');

UPDATE public.school_departments
   SET name = jsonb_strip_nulls(jsonb_build_object('en', name_en, 'ar', nullif(name_ar, '')))
              || jsonb_build_object('en', coalesce(name_en, ''))
 WHERE name = '{}'::jsonb OR NOT (name ? 'en');

UPDATE public.school_counters
   SET name = jsonb_strip_nulls(jsonb_build_object('en', name_en, 'ar', nullif(name_ar, '')))
              || jsonb_build_object('en', coalesce(name_en, ''))
 WHERE name = '{}'::jsonb OR NOT (name ? 'en');


-- ── 4. Guarantee an 'en' key from here on ──────────────────────
ALTER TABLE public.school_settings
  DROP CONSTRAINT IF EXISTS school_settings_school_name_has_en,
  DROP CONSTRAINT IF EXISTS school_settings_ticket_footer_has_en,
  DROP CONSTRAINT IF EXISTS school_settings_announce_template_has_en;
ALTER TABLE public.school_settings
  ADD CONSTRAINT school_settings_school_name_has_en       CHECK (school_name ? 'en'),
  ADD CONSTRAINT school_settings_ticket_footer_has_en     CHECK (ticket_footer ? 'en'),
  ADD CONSTRAINT school_settings_announce_template_has_en CHECK (announce_template ? 'en');

ALTER TABLE public.school_departments
  DROP CONSTRAINT IF EXISTS school_departments_name_has_en;
ALTER TABLE public.school_departments
  ADD CONSTRAINT school_departments_name_has_en CHECK (name ? 'en');

ALTER TABLE public.school_counters
  DROP CONSTRAINT IF EXISTS school_counters_name_has_en;
ALTER TABLE public.school_counters
  ADD CONSTRAINT school_counters_name_has_en CHECK (name ? 'en');


-- ── 5. Column defaults for fresh INSERTs that omit the maps ────
-- The server actions always send the map, but a hand-written INSERT or an
-- older code path that only sets `_en` still needs a valid row.
ALTER TABLE public.school_departments  ALTER COLUMN name SET DEFAULT '{"en":""}'::jsonb;
ALTER TABLE public.school_counters     ALTER COLUMN name SET DEFAULT '{"en":""}'::jsonb;
ALTER TABLE public.school_settings     ALTER COLUMN school_name       SET DEFAULT '{"en":""}'::jsonb;
ALTER TABLE public.school_settings     ALTER COLUMN ticket_footer     SET DEFAULT '{"en":""}'::jsonb;
ALTER TABLE public.school_settings     ALTER COLUMN announce_template SET DEFAULT '{"en":"Token {token}, please proceed to {counter}"}'::jsonb;


-- ══════════════════════════════════════════════════════════════
-- 6. RPCs — emit the new maps AND keep every legacy key
-- ══════════════════════════════════════════════════════════════

-- ── claim_school_token ── (only the audit-log string changes) ──
CREATE OR REPLACE FUNCTION public.claim_school_token(
  p_branch_id     uuid,
  p_department_id uuid,
  p_source        text    DEFAULT 'kiosk',
  p_is_priority   boolean DEFAULT false
)
RETURNS public.school_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept   public.school_departments;
  v_date   date;
  v_number int;
  v_token  public.school_tokens;
BEGIN
  SELECT * INTO v_dept
    FROM public.school_departments
   WHERE id = p_department_id AND branch_id = p_branch_id AND is_active;

  IF v_dept.id IS NULL THEN
    RAISE EXCEPTION 'Department % is not an active department of branch %',
      p_department_id, p_branch_id;
  END IF;

  v_date := public.school_service_date(p_branch_id);

  INSERT INTO public.school_department_days
    (customer_id, branch_id, department_id, service_date, next_number)
  VALUES
    (v_dept.customer_id, p_branch_id, p_department_id, v_date, v_dept.number_start + 1)
  ON CONFLICT (department_id, service_date) DO UPDATE
    SET next_number = school_department_days.next_number + 1
  RETURNING next_number - 1 INTO v_number;

  INSERT INTO public.school_tokens
    (customer_id, branch_id, department_id, service_date, number, token_code,
     is_priority, source)
  VALUES
    (v_dept.customer_id, p_branch_id, p_department_id, v_date, v_number,
     v_dept.prefix || v_number::text,
     p_is_priority OR v_dept.is_priority,
     p_source)
  RETURNING * INTO v_token;

  INSERT INTO public.school_activity_logs
    (customer_id, branch_id, token_id, department_id, source, type, token_code, message)
  VALUES
    (v_dept.customer_id, p_branch_id, v_token.id, p_department_id, p_source, 'issued',
     v_token.token_code, v_token.token_code || ' issued — ' || public.loc(v_dept.name, 'en'));

  RETURN v_token;
END;
$$;


-- ── call_next_school_token ── (only the audit-log string changes) ──
CREATE OR REPLACE FUNCTION public.call_next_school_token(
  p_counter_id               uuid,
  p_priority_grace_minutes   int DEFAULT 10,
  p_preference_penalty_minutes int DEFAULT 3
)
RETURNS public.school_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter public.school_counters;
  v_date    date;
  v_id      uuid;
  v_token   public.school_tokens;
BEGIN
  SELECT * INTO v_counter
    FROM public.school_counters WHERE id = p_counter_id AND is_active;

  IF v_counter.id IS NULL THEN
    RAISE EXCEPTION 'Counter % not found or inactive', p_counter_id;
  END IF;

  v_date := public.school_service_date(v_counter.branch_id);

  SELECT t.id INTO v_id
    FROM public.school_tokens t
    JOIN public.school_counter_departments cd
      ON cd.department_id = t.department_id
     AND cd.counter_id = p_counter_id
   WHERE t.branch_id = v_counter.branch_id
     AND t.service_date = v_date
     AND t.status = 'waiting'
     AND (v_counter.accepts_priority OR NOT t.is_priority)
   ORDER BY
     t.joined_at
       + make_interval(mins => cd.preference * p_preference_penalty_minutes)
       - CASE WHEN t.is_priority
              THEN make_interval(mins => p_priority_grace_minutes)
              ELSE interval '0' END
   LIMIT 1
   FOR UPDATE OF t SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.school_tokens
     SET status = 'served', served_at = now()
   WHERE counter_id = p_counter_id AND status = 'called';

  UPDATE public.school_tokens
     SET status     = 'called',
         counter_id = p_counter_id,
         called_at  = now(),
         call_count = call_count + 1
   WHERE id = v_id
  RETURNING * INTO v_token;

  INSERT INTO public.school_activity_logs
    (customer_id, branch_id, token_id, counter_id, department_id,
     source, type, token_code, message)
  VALUES
    (v_token.customer_id, v_token.branch_id, v_token.id, p_counter_id,
     v_token.department_id, 'staff', 'called', v_token.token_code,
     v_token.token_code || ' called to ' || public.loc(v_counter.name, 'en'));

  RETURN v_token;
END;
$$;


-- ── get_school_board ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_school_board(p_screen_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen   public.screens;
  v_branch   public.branches;
  v_customer public.customers;
  v_settings public.school_settings;
  v_date     date;
  v_counters json;
  v_recent   json;
  v_depts    json;
  v_ads      json;
  v_tickers  json;
BEGIN
  SELECT * INTO v_screen
    FROM public.screens WHERE screen_token = p_screen_token AND is_active;

  IF v_screen.id IS NULL THEN
    RETURN json_build_object('status', 'not-found');
  END IF;

  UPDATE public.screens SET last_seen_at = now() WHERE id = v_screen.id;

  SELECT * INTO v_branch   FROM public.branches  WHERE id = v_screen.branch_id;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_screen.customer_id;

  IF NOT v_customer.is_active
     OR (v_customer.plan_expires_at IS NOT NULL AND v_customer.plan_expires_at < now()) THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_settings FROM public.school_settings WHERE branch_id = v_branch.id;
  v_date := public.school_service_date(v_branch.id);

  -- One row per window. `name` / `department` are the new locale maps; the
  -- `_en` / `_ar` scalars stay for older clients.
  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.display_order, r.name_en), '[]'::json)
    INTO v_counters
    FROM (
      SELECT c.id,
             c.name       AS name,
             c.name_en, c.name_ar,
             c.display_order, c.is_open, c.last_seen_at,
             t.id            AS token_id,
             t.token_code,
             t.called_at,
             t.recall_count,
             t.is_priority,
             d.name          AS department,
             d.name_en       AS department_en,
             d.name_ar       AS department_ar,
             d.color         AS department_color
        FROM public.school_counters c
        LEFT JOIN public.school_tokens t
               ON t.counter_id = c.id
              AND t.status = 'called'
              AND t.service_date = v_date
        LEFT JOIN public.school_departments d ON d.id = t.department_id
       WHERE c.branch_id = v_branch.id AND c.is_active
    ) r;

  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.served_at DESC), '[]'::json)
    INTO v_recent
    FROM (
      SELECT t.token_code, t.served_at,
             c.name    AS counter,
             c.name_en AS counter_en,
             c.name_ar AS counter_ar
        FROM public.school_tokens t
        LEFT JOIN public.school_counters c ON c.id = t.counter_id
       WHERE t.branch_id = v_branch.id
         AND t.service_date = v_date
         AND t.status = 'served'
       ORDER BY t.served_at DESC
       LIMIT 8
    ) r;

  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.display_order), '[]'::json)
    INTO v_depts
    FROM (
      SELECT d.id,
             d.name    AS name,
             d.name_en, d.name_ar,
             d.color, d.display_order,
             count(t.id) FILTER (WHERE t.status = 'waiting') AS waiting
        FROM public.school_departments d
        LEFT JOIN public.school_tokens t
               ON t.department_id = d.id AND t.service_date = v_date
       WHERE d.branch_id = v_branch.id AND d.is_active
       GROUP BY d.id
    ) r;

  DECLARE
    v_screen_ad_count int;
  BEGIN
    SELECT count(*) INTO v_screen_ad_count
      FROM public.screen_ads sa WHERE sa.screen_id = v_screen.id;

    IF v_screen_ad_count > 0 THEN
      SELECT json_agg(a ORDER BY sa.display_order ASC) INTO v_ads
        FROM public.screen_ads sa
        JOIN public.ads a ON a.id = sa.ad_id
       WHERE sa.screen_id = v_screen.id AND a.is_active = true;
    ELSE
      DECLARE
        v_branch_ads   json;
        v_customer_ads json;
      BEGIN
        SELECT json_agg(a ORDER BY a.display_order) INTO v_branch_ads
          FROM public.ads a WHERE a.branch_id = v_branch.id AND a.is_active = true;

        SELECT json_agg(a ORDER BY a.display_order) INTO v_customer_ads
          FROM public.ads a
         WHERE a.customer_id = v_customer.id AND a.branch_id IS NULL AND a.is_active = true;

        IF v_branch_ads IS NULL THEN
          v_ads := v_customer_ads;
        ELSIF v_customer_ads IS NULL THEN
          v_ads := v_branch_ads;
        ELSE
          CASE v_customer.branch_ad_mode
            WHEN 'replace' THEN v_ads := v_branch_ads;
            WHEN 'prepend' THEN v_ads := (SELECT json_agg(x) FROM (SELECT * FROM json_array_elements(v_branch_ads) UNION ALL SELECT * FROM json_array_elements(v_customer_ads)) x);
            ELSE                v_ads := (SELECT json_agg(x) FROM (SELECT * FROM json_array_elements(v_customer_ads) UNION ALL SELECT * FROM json_array_elements(v_branch_ads)) x);
          END CASE;
        END IF;
      END;
    END IF;
  END;

  SELECT json_agg(t ORDER BY t.display_order) INTO v_tickers
    FROM public.ticker_messages t
   WHERE t.is_active = true
     AND (t.branch_id = v_branch.id OR (t.branch_id IS NULL AND t.customer_id = v_customer.id));

  RETURN json_build_object(
    'status',      'ok',
    'screenId',    v_screen.id,
    'branchId',    v_branch.id,
    'customerId',  v_customer.id,
    'serviceDate', v_date,
    'schoolName',  coalesce(nullif(public.loc(v_settings.school_name, 'en'), ''), v_customer.business_name),
    'schoolNameAr', public.loc(v_settings.school_name, 'ar'),
    'schoolNameI18n',
        coalesce(v_settings.school_name, '{}'::jsonb)
        || jsonb_build_object('en', coalesce(nullif(public.loc(v_settings.school_name, 'en'), ''), v_customer.business_name)),
    'logoUrl',     coalesce(nullif(v_settings.logo_url, ''), v_customer.logo_url),
    'primaryColor', v_customer.primary_color,
    'announcementLang', v_screen.announcement_lang,
    'announceLocales', coalesce(v_settings.languages, ARRAY['en']),
    'announceEnabled',  coalesce(v_settings.announce_enabled, true),
    'announceTemplateEn', coalesce(nullif(public.loc(v_settings.announce_template, 'en'), ''), 'Token {token}, please proceed to {counter}'),
    'announceTemplateAr', public.loc(v_settings.announce_template, 'ar'),
    'announceTemplateI18n',
        coalesce(v_settings.announce_template, '{}'::jsonb)
        || jsonb_build_object('en', coalesce(nullif(public.loc(v_settings.announce_template, 'en'), ''), 'Token {token}, please proceed to {counter}')),
    'showClock',   v_screen.show_clock,
    'tickerText',  v_branch.ticker_text,
    'counters',    v_counters,
    'recent',      v_recent,
    'departments', v_depts,
    'ads',         coalesce(v_ads, '[]'::json),
    'tickers',     coalesce(v_tickers, '[]'::json)
  );
END;
$$;


-- ── get_public_ticket_status ──────────────────────────────────
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
  v_school_name    text;
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

  v_enabled := coalesce(v_customer.school_public_tracking_enabled, false)
           AND coalesce(v_settings.public_tracking_enabled, true);

  IF NOT v_enabled THEN
    RETURN json_build_object('status', 'disabled');
  END IF;

  v_today    := public.school_service_date(v_token.branch_id);
  v_is_today := (v_token.service_date = v_today);

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

  SELECT token_code INTO v_now_serving
    FROM public.school_tokens
   WHERE department_id = v_token.department_id
     AND service_date = v_token.service_date
     AND status = 'called'
   ORDER BY called_at DESC
   LIMIT 1;

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
    v_avg_gap_secs := coalesce(v_branch.avg_service_time, 5) * 60;
  END IF;

  v_eta_secs := v_waiting_ahead * v_avg_gap_secs;

  v_school_name := coalesce(nullif(public.loc(v_settings.school_name, 'en'), ''), v_customer.business_name);

  RETURN json_build_object(
    'status',            'ok',
    'schoolNameEn',      v_school_name,
    'schoolNameAr',      public.loc(v_settings.school_name, 'ar'),
    'schoolName',
        coalesce(v_settings.school_name, '{}'::jsonb)
        || jsonb_build_object('en', v_school_name),
    'logoUrl',           coalesce(nullif(v_settings.logo_url, ''), v_customer.logo_url),
    'languages',         coalesce(v_settings.languages, ARRAY['en']),
    'tokenCode',         v_token.token_code,
    'tokenStatus',       v_token.status,
    'isPriority',        v_token.is_priority,
    'joinedAt',          v_token.joined_at,
    'calledAt',          v_token.called_at,
    'departmentNameEn',  public.loc(v_dept.name, 'en'),
    'departmentNameAr',  public.loc(v_dept.name, 'ar'),
    'departmentName',    coalesce(v_dept.name, '{}'::jsonb),
    'counterNameEn',     public.loc(v_counter.name, 'en'),
    'counterNameAr',     public.loc(v_counter.name, 'ar'),
    'counterName',       coalesce(v_counter.name, '{}'::jsonb),
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
