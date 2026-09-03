-- ══════════════════════════════════════════════════════════════
-- HOSPITAL QUEUE SYSTEM (India vertical)
-- ══════════════════════════════════════════════════════════════
-- The third vertical (after 'business' and 'school'): per-doctor OPD queues,
-- triage, multi-stage patient journey (consult → lab → review → pharmacy →
-- billing), and a vernacular voice board. Modelled on
-- 20260825_school_queue_system.sql — same invariants, same traps avoided.
--
-- Safe to run repeatedly: every statement is IF NOT EXISTS / OR REPLACE.
--
-- NOT mirrored into supabase/schema.sql — that file opens with
-- `drop table … cascade`, which would either orphan these tables or nuke
-- hospital data on a re-run. Keep a separate fresh-install bundle if wanted.
--
-- Token-series and service-date conventions match the school vertical exactly:
--   · series is per DEPARTMENT (two doctors in Orthopaedics share the O1xx
--     series — how Indian OPD tickets actually read), daily reset is free via
--     the per-(department, service_date) cursor row,
--   · "today" is computed only in SQL via hospital_service_date(),
--   · serving state is derived from tokens (one 'called' per room), never a
--     mutable pointer,
--   · RLS is service-role-only (the platform's RLS is self-referentially
--     broken — see userGuide/DEV_NOTES.md),
--   · realtime is broadcast + poll, so this migration deliberately does NOT
--     alter the supabase_realtime publication (browser holds the anon key and
--     these rows link to patient identity).
-- ══════════════════════════════════════════════════════════════


-- ── 0. Vertical & screen kind widenings ────────────────────────
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_vertical_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_vertical_check
    CHECK (vertical IN ('business', 'school', 'hospital'));

ALTER TABLE public.license_keys
  DROP CONSTRAINT IF EXISTS license_keys_vertical_check;
ALTER TABLE public.license_keys
  ADD CONSTRAINT license_keys_vertical_check
    CHECK (vertical IN ('business', 'school', 'hospital'));

ALTER TABLE public.screens
  DROP CONSTRAINT IF EXISTS screens_kind_check;
ALTER TABLE public.screens
  ADD CONSTRAINT screens_kind_check
    CHECK (kind IN ('queue', 'school', 'hospital'));

-- Hospital entitlements & add-ons — distributor-set ceilings the tenant
-- cannot raise (same shape as 20260901_school_entitlements.sql).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS max_hospital_departments int NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS max_hospital_rooms int NOT NULL DEFAULT 8,
  -- Billable add-on: WhatsApp/SMS patient notification (Phase 2 surface).
  ADD COLUMN IF NOT EXISTS hospital_notifications_enabled boolean NOT NULL DEFAULT false;


-- ══════════════════════════════════════════════════════════════
-- 1. SETTINGS (one row per branch)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_settings (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  hospital_name jsonb not null default '{}'::jsonb,
  logo_url      text not null default '',
  languages     text[] not null default '{en}',
  ticket_footer jsonb not null default '{}'::jsonb,
  kiosk_idle_seconds int not null default 20,
  priority_enabled   boolean not null default true,
  announce_enabled   boolean not null default true,
  announce_template  jsonb not null default '{}'::jsonb,
  print_enabled      boolean not null default true,
  -- Appointment:walk-in interleave — serve this many appointment tokens
  -- before a walk-in when both lanes are waiting (Phase 2 surfaces it).
  appt_walkin_ratio int not null default 2,
  -- Free revisit window (standard Indian OPD practice). 0 disables.
  followup_free_days int not null default 7,
  priority_grace_minutes int not null default 10,
  -- DPDP: patient PII is nulled this many days after the visit completes.
  -- NULL means "keep forever" until the hospital sets a policy.
  patient_data_retention_days int,
  public_tracking_enabled boolean not null default true,
  timezone        text not null default 'Asia/Kolkata',
  day_start_time  time not null default '00:00',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint hospital_settings_branch_uniq unique (branch_id),
  constraint hospital_settings_name_has_en check (hospital_name ? 'en')
);
CREATE INDEX IF NOT EXISTS hospital_settings_customer_idx
  ON public.hospital_settings(customer_id);


-- ══════════════════════════════════════════════════════════════
-- 2. DEPARTMENTS — OPD specialities AND service points, one table
-- ══════════════════════════════════════════════════════════════
-- type drives behaviour: the kiosk shows 'opd' (and 'triage' destinations);
-- the doctor console's SEND TO targets lab/radiology/pharmacy; billing is a
-- service point too. A department's prefix is the visible half of every token
-- it issues.
CREATE TABLE IF NOT EXISTS public.hospital_departments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  name          jsonb not null default '{}'::jsonb,
  prefix        text not null,
  type          text not null default 'opd'
                check (type in ('opd','lab','radiology','pharmacy','billing','triage')),
  number_start  int not null default 101,
  color         text not null default '#0F766E',
  icon          text not null default 'Stethoscope',
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hospital_departments_name_has_en check (name ? 'en')
);

-- Two active departments sharing a prefix would collide on token_code and
-- start throwing at the kiosk mid-day.
CREATE UNIQUE INDEX IF NOT EXISTS hospital_departments_branch_prefix_uniq
  ON public.hospital_departments(branch_id, prefix) WHERE is_active;
CREATE INDEX IF NOT EXISTS hospital_departments_branch_idx
  ON public.hospital_departments(branch_id, is_active, display_order);


-- ══════════════════════════════════════════════════════════════
-- 3. DOCTORS — the queue-ordering entity
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_doctors (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  department_id uuid not null references public.hospital_departments(id) on delete cascade,
  name          text not null,          -- e.g. 'Dr. Sharma' — staff, not PII
  specialization text not null default '',
  fee_paise     int not null default 0,
  -- Rolling estimate the board/ticket ETA and the interleave use. Reception
  -- can set it; a job may refresh it from served durations later.
  avg_consult_minutes int not null default 10,
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS hospital_doctors_branch_idx
  ON public.hospital_doctors(branch_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS hospital_doctors_dept_idx
  ON public.hospital_doctors(department_id, is_active);


-- ══════════════════════════════════════════════════════════════
-- 4. DOCTOR SCHEDULES & LEAVES
-- ══════════════════════════════════════════════════════════════
-- A doctor with no schedule row for today does not appear on the kiosk.
-- weekday: 0 = Sunday … 6 = Saturday (Postgres extract(dow …)).
CREATE TABLE IF NOT EXISTS public.hospital_doctor_schedules (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  doctor_id     uuid not null references public.hospital_doctors(id) on delete cascade,
  weekday       int not null check (weekday between 0 and 6),
  session       text not null default 'am' check (session in ('am','pm')),
  start_time    time not null,
  end_time      time not null,
  slot_minutes  int not null default 15,
  max_tokens    int not null default 40,
  created_at    timestamptz not null default now(),
  constraint hospital_doctor_schedules_uniq unique (doctor_id, weekday, session),
  constraint hospital_doctor_schedules_time_ok check (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS hospital_doctor_schedules_doctor_idx
  ON public.hospital_doctor_schedules(doctor_id);

-- One row per day off. Marking a leave must cascade (block kiosk + bookings);
-- the RPC checks this table, never the schedule alone.
CREATE TABLE IF NOT EXISTS public.hospital_doctor_leaves (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  doctor_id     uuid not null references public.hospital_doctors(id) on delete cascade,
  leave_date    date not null,
  reason        text not null default '',
  created_at    timestamptz not null default now(),
  constraint hospital_doctor_leaves_uniq unique (doctor_id, leave_date)
);
CREATE INDEX IF NOT EXISTS hospital_doctor_leaves_doctor_idx
  ON public.hospital_doctor_leaves(doctor_id, leave_date);


-- ══════════════════════════════════════════════════════════════
-- 5. ROOMS — the calling surface (consult rooms AND service bays)
-- ══════════════════════════════════════════════════════════════
-- A room is the leaf device the doctor/pharmacist/lab tech sits at. The
-- console authenticates with room_token, exactly like school_counters.
-- current_doctor_id is which doctor sits here TODAY — set by reception at
-- session start, a rota fact, not a schedule fact.
CREATE TABLE IF NOT EXISTS public.hospital_rooms (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  department_id uuid not null references public.hospital_departments(id) on delete cascade,
  label         text not null,          -- 'Room 4', 'Lab Bay 2', 'Pharmacy 1'
  room_token    text not null default gen_random_uuid()::text,
  current_doctor_id uuid references public.hospital_doctors(id) on delete set null,
  display_order int not null default 0,
  is_open       boolean not null default true,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hospital_rooms_token_uniq unique (room_token),
  constraint hospital_rooms_branch_label_uniq unique (branch_id, label)
);
CREATE INDEX IF NOT EXISTS hospital_rooms_branch_idx
  ON public.hospital_rooms(branch_id, is_active, display_order);


-- ══════════════════════════════════════════════════════════════
-- 6. PATIENTS — the ONLY PII table (DPDP)
-- ══════════════════════════════════════════════════════════════
-- Customer-wide (a patient known at one branch is known at the group's
-- others); visits are branch-scoped. Token rows never carry the name — they
-- reference patient_id, and boards/tickets/announcements never join this
-- table.
CREATE TABLE IF NOT EXISTS public.hospital_patients (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  uhid          text not null,          -- per-customer patient number
  name          text not null,
  phone         text not null default '',
  dob           date,
  gender        text check (gender in ('male','female','other')),
  abha_number   text,                   -- ABDM (Phase 3) — column exists now so
                                        -- the migration is free later
  consent_at    timestamptz not null default now(),  -- DPDP consent captured at registration
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hospital_patients_uhid_uniq unique (customer_id, uhid)
);
CREATE INDEX IF NOT EXISTS hospital_patients_customer_idx
  ON public.hospital_patients(customer_id, name);
CREATE INDEX IF NOT EXISTS hospital_patients_phone_idx
  ON public.hospital_patients(customer_id, phone);


-- ══════════════════════════════════════════════════════════════
-- 7. VISITS — the thread that ties a multi-stage journey together
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_visits (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  patient_id    uuid not null references public.hospital_patients(id) on delete cascade,
  visit_date    date not null,
  type          text not null default 'new' check (type in ('new','followup')),
  status        text not null default 'active' check (status in ('active','completed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- One active visit per patient per branch — the check-in flow reuses it.
CREATE UNIQUE INDEX IF NOT EXISTS hospital_visits_one_active
  ON public.hospital_visits(patient_id, branch_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS hospital_visits_branch_date_idx
  ON public.hospital_visits(branch_id, visit_date);


-- ══════════════════════════════════════════════════════════════
-- 8. APPOINTMENTS (Phase 2 surface; table ships now — columns are free)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_appointments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  doctor_id     uuid not null references public.hospital_doctors(id) on delete cascade,
  patient_id    uuid not null references public.hospital_patients(id) on delete cascade,
  slot_time     timestamptz not null,
  booked_via    text not null default 'reception' check (booked_via in ('pwa','reception','whatsapp')),
  fee_paise     int not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  status        text not null default 'booked' check (status in ('booked','checked_in','cancelled','noshow')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS hospital_appointments_doctor_idx
  ON public.hospital_appointments(doctor_id, slot_time);
CREATE INDEX IF NOT EXISTS hospital_appointments_branch_idx
  ON public.hospital_appointments(branch_id, status);


-- ══════════════════════════════════════════════════════════════
-- 9. TOKENS — the central row. One token follows the patient across
--    every stage of a visit; the patient never juggles two numbers.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_tokens (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  visit_id      uuid references public.hospital_visits(id) on delete set null,
  department_id uuid not null references public.hospital_departments(id) on delete restrict,
  doctor_id     uuid references public.hospital_doctors(id) on delete set null,
  room_id       uuid references public.hospital_rooms(id) on delete set null,
  service_date  date not null,
  number        int  not null,
  token_code    text not null,
  -- Which leg of the journey this token is currently queuing for.
  stage         text not null default 'consult'
                check (stage in ('registration','triage','consult','lab','radiology','pharmacy','billing','review')),
  status        text not null default 'waiting'
                check (status in ('waiting','called','serving','held','served','no-show','cancelled')),
  -- Social priority (expected in India): a visible kiosk/reception toggle,
  -- not a hidden admin flag. NULL = normal.
  priority_category text check (priority_category in ('senior','emergency','pregnant','differently-abled')),
  source        text not null default 'kiosk'
                check (source in ('kiosk','reception','appointment','whatsapp','api')),
  appointment_id uuid references public.hospital_appointments(id) on delete set null,
  -- Short non-enumerable handle for the public tracking QR — distinct from
  -- token_code, which repeats every day and across branches. Same scheme as
  -- school (20260902_school_public_tracking.sql).
  public_code   text,
  -- Language the patient was reading at the kiosk — the tracker opens in it.
  locale        text,
  notes         text not null default '',
  joined_at     timestamptz not null default now(),
  called_at     timestamptz,
  served_at     timestamptz,
  call_count    int not null default 0,
  recall_count  int not null default 0,
  created_at    timestamptz not null default now(),
  constraint hospital_tokens_code_uniq unique (branch_id, service_date, token_code)
);

-- One live token per room, enforced by the database rather than a mutable
-- "current_token_id" pointer that would drift on a crashed action.
CREATE UNIQUE INDEX IF NOT EXISTS hospital_tokens_one_called_per_room
  ON public.hospital_tokens(room_id) WHERE status = 'called';
-- Check-in is idempotent: a double-tap returns the existing token.
CREATE UNIQUE INDEX IF NOT EXISTS hospital_tokens_one_per_appointment
  ON public.hospital_tokens(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hospital_tokens_public_code_uniq
  ON public.hospital_tokens(public_code) WHERE public_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS hospital_tokens_branch_day_status_idx
  ON public.hospital_tokens(branch_id, service_date, status);
CREATE INDEX IF NOT EXISTS hospital_tokens_doctor_day_status_idx
  ON public.hospital_tokens(doctor_id, service_date, status, joined_at);
CREATE INDEX IF NOT EXISTS hospital_tokens_dept_day_status_idx
  ON public.hospital_tokens(department_id, service_date, status, joined_at);
CREATE INDEX IF NOT EXISTS hospital_tokens_visit_idx
  ON public.hospital_tokens(visit_id);

-- Default the public code the same way school does, so every issuance path
-- (claim RPC, check-in, future API) gets one for free. The generator is the
-- school's: same 30-symbol unambiguous alphabet, same collision loop.
CREATE OR REPLACE FUNCTION public.gen_hospital_public_code() RETURNS text
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
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.hospital_tokens WHERE public_code = code);
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.hospital_tokens
  ALTER COLUMN public_code SET DEFAULT public.gen_hospital_public_code();
UPDATE public.hospital_tokens SET public_code = public.gen_hospital_public_code()
  WHERE public_code IS NULL;


-- ══════════════════════════════════════════════════════════════
-- 10. VITALS — one row per token, filled at the triage stage
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hospital_vitals (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  token_id      uuid not null references public.hospital_tokens(id) on delete cascade,
  bp_systolic   int,
  bp_diastolic  int,
  spo2          int,
  temp_c        numeric(4,1),
  weight_kg     numeric(5,1),
  notes         text not null default '',
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint hospital_vitals_token_uniq unique (token_id)
);


-- ══════════════════════════════════════════════════════════════
-- 11. DAILY CURSORS
-- ══════════════════════════════════════════════════════════════
-- Per-department daily series (school pattern): a new date row starts at
-- number_start, so the daily reset is free — no cron, no alter sequence.
CREATE TABLE IF NOT EXISTS public.hospital_department_days (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  department_id uuid not null references public.hospital_departments(id) on delete cascade,
  service_date  date not null,
  next_number   int not null,
  created_at    timestamptz not null default now(),
  constraint hospital_department_days_uniq unique (department_id, service_date)
);

-- Per-doctor day state for the appointment/walk-in interleave: how many each
-- lane served, and whether the next pick should favour an appointment.
CREATE TABLE IF NOT EXISTS public.hospital_doctor_days (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  doctor_id     uuid not null references public.hospital_doctors(id) on delete cascade,
  service_date  date not null,
  served_count  int not null default 0,
  walkins_since_last_appt int not null default 0,
  created_at    timestamptz not null default now(),
  constraint hospital_doctor_days_uniq unique (doctor_id, service_date)
);


-- ══════════════════════════════════════════════════════════════
-- 12. TOKEN EVENTS — insert-only journey audit
-- ══════════════════════════════════════════════════════════════
-- activity_logs can't be reused (restaurant CHECK + FK to queue_entries).
-- This is the source for the stage funnel, every wait-time report, and the
-- answer to "where did the patient spend three hours".
CREATE TABLE IF NOT EXISTS public.hospital_token_events (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  token_id      uuid references public.hospital_tokens(id) on delete set null,
  room_id       uuid references public.hospital_rooms(id) on delete set null,
  department_id uuid references public.hospital_departments(id) on delete set null,
  doctor_id     uuid references public.hospital_doctors(id) on delete set null,
  performed_by  uuid references public.profiles(id) on delete set null,
  actor         text not null default 'room'
                check (actor in ('kiosk','reception','room','system')),
  from_status   text,
  to_status     text not null,
  from_stage    text,
  to_stage      text,
  token_code    text not null default '',
  message       text not null default '',
  created_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS hospital_token_events_branch_created_idx
  ON public.hospital_token_events(branch_id, created_at desc);
CREATE INDEX IF NOT EXISTS hospital_token_events_token_idx
  ON public.hospital_token_events(token_id, created_at);

-- DPDP: who looked at which patient record, when. Written from the DAL read
-- paths for patient detail views, never from boards.
CREATE TABLE IF NOT EXISTS public.hospital_patient_access_logs (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  patient_id    uuid references public.hospital_patients(id) on delete set null,
  accessed_by   uuid references public.profiles(id) on delete set null,
  reason        text not null default '',
  created_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS hospital_patient_access_idx
  ON public.hospital_patient_access_logs(patient_id, created_at desc);

-- Notification delivery log (Phase 2): a BSP outage must not block calling,
-- and support must be able to answer "did you send it".
CREATE TABLE IF NOT EXISTS public.hospital_notification_logs (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  token_id      uuid references public.hospital_tokens(id) on delete set null,
  channel       text not null check (channel in ('whatsapp','sms')),
  template_key  text not null,
  status        text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  detail        text not null default '',
  created_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════
-- RLS — service-role-only (the platform's RLS is self-referentially broken;
-- every read/write goes through createSupabaseServiceClient + app guards)
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hospital_settings','hospital_departments','hospital_doctors',
    'hospital_doctor_schedules','hospital_doctor_leaves','hospital_rooms',
    'hospital_patients','hospital_visits','hospital_appointments',
    'hospital_tokens','hospital_vitals','hospital_department_days',
    'hospital_doctor_days','hospital_token_events','hospital_patient_access_logs',
    'hospital_notification_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
-- RPC: service date — "today" in the branch's timezone, rolled back by
-- day_start_time. The single source of truth every surface derives from.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hospital_service_date(p_branch_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (now() AT TIME ZONE coalesce(s.timezone, 'Asia/Kolkata'))
    - coalesce(s.day_start_time, '00:00'::time)::interval
  )::date
  FROM public.branches b
  LEFT JOIN public.hospital_settings s ON s.branch_id = b.id
  WHERE b.id = p_branch_id;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: claim_hospital_token — walk-in issuance
-- ══════════════════════════════════════════════════════════════
-- The cursor bump is a single INSERT … ON CONFLICT DO UPDATE on purpose: the
-- one-row upsert holds the row lock to commit, so concurrent kiosks serialize
-- without an advisory lock. Select-then-update would be a TOCTOU race, and
-- because a plpgsql function is one transaction a failed token insert rolls
-- the increment back — the series stays gapless.
--
-- Validates the doctor is actually serving today (schedule − leave − cap) so
-- the kiosk can never hand out a token for a doctor who is not in.
CREATE OR REPLACE FUNCTION public.claim_hospital_token(
  p_branch_id       uuid,
  p_department_id   uuid,
  p_doctor_id       uuid    DEFAULT NULL,
  p_visit_id        uuid    DEFAULT NULL,
  p_source          text    DEFAULT 'kiosk',
  p_priority_category text  DEFAULT NULL,
  p_locale          text    DEFAULT NULL
)
RETURNS public.hospital_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept   public.hospital_departments;
  v_date   date;
  v_number int;
  v_token  public.hospital_tokens;
  v_dow    int;
BEGIN
  SELECT * INTO v_dept
    FROM public.hospital_departments
   WHERE id = p_department_id AND branch_id = p_branch_id AND is_active;

  IF v_dept.id IS NULL THEN
    RAISE EXCEPTION 'Department % is not an active department of branch %',
      p_department_id, p_branch_id;
  END IF;

  -- You cannot walk in to a service point — those queues are fed by transfer.
  IF v_dept.type <> 'opd' AND v_dept.type <> 'triage' THEN
    RAISE EXCEPTION 'Department % (type %) does not accept walk-in tokens',
      p_department_id, v_dept.type;
  END IF;

  v_date := public.hospital_service_date(p_branch_id);

  -- OPD tokens name a doctor; that doctor must be on duty today.
  IF v_dept.type = 'opd' AND p_doctor_id IS NOT NULL THEN
    v_dow := extract(dow from v_date)::int;
    IF NOT EXISTS (
      SELECT 1 FROM public.hospital_doctors d
      JOIN public.hospital_doctor_schedules s
        ON s.doctor_id = d.id AND s.weekday = v_dow
      WHERE d.id = p_doctor_id
        AND d.branch_id = p_branch_id
        AND d.department_id = p_department_id
        AND d.is_active
    ) THEN
      RAISE EXCEPTION 'Doctor % has no schedule at department % today',
        p_doctor_id, p_department_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.hospital_doctor_leaves
      WHERE doctor_id = p_doctor_id AND leave_date = v_date
    ) THEN
      RAISE EXCEPTION 'Doctor % is on leave today', p_doctor_id;
    END IF;
  END IF;

  INSERT INTO public.hospital_department_days
    (customer_id, branch_id, department_id, service_date, next_number)
  VALUES
    (v_dept.customer_id, p_branch_id, p_department_id, v_date, v_dept.number_start + 1)
  ON CONFLICT (department_id, service_date) DO UPDATE
    SET next_number = hospital_department_days.next_number + 1
  RETURNING next_number - 1 INTO v_number;

  INSERT INTO public.hospital_tokens
    (customer_id, branch_id, visit_id, department_id, doctor_id, service_date,
     number, token_code, stage, priority_category, source, locale)
  VALUES
    (v_dept.customer_id, p_branch_id, p_visit_id, p_department_id, p_doctor_id, v_date,
     v_number, v_dept.prefix || v_number::text,
     CASE WHEN v_dept.type = 'triage' THEN 'triage' ELSE 'consult' END,
     p_priority_category, p_source, nullif(p_locale, ''))
  RETURNING * INTO v_token;

  INSERT INTO public.hospital_token_events
    (customer_id, branch_id, token_id, department_id, doctor_id, actor,
     from_status, to_status, to_stage, token_code, message)
  VALUES
    (v_dept.customer_id, p_branch_id, v_token.id, p_department_id, p_doctor_id, p_source,
     NULL, 'waiting', v_token.stage, v_token.token_code,
     v_token.token_code || ' issued — ' || public.loc(v_dept.name, 'en'));

  RETURN v_token;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: call_next_hospital_token — the heart of the system
-- ══════════════════════════════════════════════════════════════
-- A room resolves its doctor (OPD) or its department (service point), picks
-- the next waiting token FOR UPDATE … SKIP LOCKED (two rooms on one pool must
-- never receive the same token), closes out whatever it was serving
-- (→ served), stamps called/called_at/room_id, and updates the interleave
-- cursor.
--
-- Ordering is a single effective-wait key, not hard sort columns, so neither
-- the normal lane nor a returning review patient can starve:
--   effective = joined_at
--             - priority_grace  (priority tokens only — they jump, but only
--                              past people who waited less than the window)
--             - review_boost    (a patient back from the lab goes next-ish,
--                              never instantly)
-- … with the appointment/walk-in ratio applied as a hard preference: if this
-- doctor has served `appt_walkin_ratio` walk-ins since the last appointment,
-- an appointment token is picked first regardless of the key.
CREATE OR REPLACE FUNCTION public.call_next_hospital_token(
  p_room_id                 uuid,
  p_priority_grace_minutes  int DEFAULT NULL,  -- NULL → read hospital_settings
  p_review_boost_minutes    int DEFAULT 15
)
RETURNS public.hospital_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room    public.hospital_rooms;
  v_dept    public.hospital_departments;
  v_date    date;
  v_grace   int;
  v_ratio   int;
  v_id      uuid;
  v_token   public.hospital_tokens;
  v_day     public.hospital_doctor_days;
  v_is_appt boolean;
BEGIN
  SELECT * INTO v_room
    FROM public.hospital_rooms WHERE id = p_room_id AND is_active;

  IF v_room.id IS NULL THEN
    RAISE EXCEPTION 'Room % not found or inactive', p_room_id;
  END IF;

  SELECT * INTO v_dept
    FROM public.hospital_departments WHERE id = v_room.department_id;

  v_date := public.hospital_service_date(v_room.branch_id);

  SELECT coalesce(s.priority_grace_minutes, 10),
         coalesce(s.appt_walkin_ratio, 2)
    INTO v_grace, v_ratio
    FROM public.hospital_settings s WHERE s.branch_id = v_room.branch_id;
  v_grace := coalesce(p_priority_grace_minutes, v_grace, 10);
  v_ratio := coalesce(v_ratio, 2);

  -- ── OPD room with a doctor seated: order that doctor's queue, with the
  --    appointment/walk-in interleave. ──
  IF v_room.current_doctor_id IS NOT NULL AND v_dept.type = 'opd' THEN
    -- Ensure the doctor-day cursor row exists.
    INSERT INTO public.hospital_doctor_days
      (customer_id, branch_id, doctor_id, service_date)
    VALUES (v_room.customer_id, v_room.branch_id, v_room.current_doctor_id, v_date)
    ON CONFLICT (doctor_id, service_date) DO NOTHING;

    SELECT * INTO v_day FROM public.hospital_doctor_days
     WHERE doctor_id = v_room.current_doctor_id AND service_date = v_date;

    -- Hard interleave: if we've served `ratio` walk-ins since the last
    -- appointment, take the oldest waiting appointment first.
    IF v_day.walkins_since_last_appt >= v_ratio THEN
      SELECT t.id INTO v_id
        FROM public.hospital_tokens t
       WHERE t.doctor_id = v_room.current_doctor_id
         AND t.service_date = v_date
         AND t.status = 'waiting'
         AND t.source = 'appointment'
       ORDER BY t.joined_at ASC
       LIMIT 1
       FOR UPDATE OF t SKIP LOCKED;
    END IF;

    -- Otherwise (or if no appointment is waiting) the effective-wait key.
    IF v_id IS NULL THEN
      SELECT t.id INTO v_id
        FROM public.hospital_tokens t
       WHERE t.doctor_id = v_room.current_doctor_id
         AND t.service_date = v_date
         AND t.status = 'waiting'
       ORDER BY
         t.joined_at
           - CASE WHEN t.priority_category IS NOT NULL
                  THEN make_interval(mins => v_grace) ELSE interval '0' END
           - CASE WHEN t.stage = 'review'
                  THEN make_interval(mins => p_review_boost_minutes) ELSE interval '0' END
       LIMIT 1
       FOR UPDATE OF t SKIP LOCKED;
    END IF;

  ELSE
    -- ── Service point / triage room: one department pool, same key. ──
    SELECT t.id INTO v_id
      FROM public.hospital_tokens t
     WHERE t.department_id = v_room.department_id
       AND t.service_date = v_date
       AND t.status = 'waiting'
     ORDER BY
       t.joined_at
         - CASE WHEN t.priority_category IS NOT NULL
                THEN make_interval(mins => v_grace) ELSE interval '0' END
     LIMIT 1
     FOR UPDATE OF t SKIP LOCKED;
  END IF;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Close out the previous token first: the partial unique index allows only
  -- one 'called' row per room.
  UPDATE public.hospital_tokens
     SET status = 'served', served_at = now()
   WHERE room_id = p_room_id AND status = 'called';

  UPDATE public.hospital_tokens
     SET status     = 'called',
         room_id    = p_room_id,
         called_at  = now(),
         call_count = call_count + 1
   WHERE id = v_id
  RETURNING * INTO v_token;

  -- Update the interleave cursor for OPD calls.
  IF v_room.current_doctor_id IS NOT NULL AND v_dept.type = 'opd' THEN
    v_is_appt := (v_token.source = 'appointment');
    UPDATE public.hospital_doctor_days
       SET served_count = served_count + 1,
           walkins_since_last_appt = CASE WHEN v_is_appt THEN 0
                                          ELSE walkins_since_last_appt + 1 END
     WHERE doctor_id = v_room.current_doctor_id AND service_date = v_date;
  END IF;

  INSERT INTO public.hospital_token_events
    (customer_id, branch_id, token_id, room_id, department_id, doctor_id, actor,
     from_status, to_status, to_stage, token_code, message)
  VALUES
    (v_token.customer_id, v_token.branch_id, v_token.id, p_room_id,
     v_token.department_id, v_token.doctor_id, 'room',
     'waiting', 'called', v_token.stage, v_token.token_code,
     v_token.token_code || ' called to ' || v_room.label);

  RETURN v_token;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: transfer_hospital_token — the multi-stage mechanic
-- ══════════════════════════════════════════════════════════════
-- Doctor sends the patient to the lab; lab sends them back for review. The
-- SAME row moves — token_code never changes, so the printed ticket and the
-- patient's number survive the whole visit. Current stage is served, the new
-- stage re-queues as waiting with a fresh joined_at (honest per-stage wait),
-- and one events row covers the whole hop.
--
-- The review re-entry is just this RPC with p_to_stage='review' and the
-- original doctor restored — no special-case table.
CREATE OR REPLACE FUNCTION public.transfer_hospital_token(
  p_token_id          uuid,
  p_to_department_id  uuid,
  p_to_stage          text,
  p_actor             text DEFAULT 'room',
  p_restore_doctor    boolean DEFAULT false
)
RETURNS public.hospital_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token  public.hospital_tokens;
  v_dept   public.hospital_departments;
  v_doctor uuid;
BEGIN
  SELECT * INTO v_token FROM public.hospital_tokens WHERE id = p_token_id;
  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'Token % not found', p_token_id;
  END IF;

  SELECT * INTO v_dept FROM public.hospital_departments
   WHERE id = p_to_department_id AND branch_id = v_token.branch_id AND is_active;
  IF v_dept.id IS NULL THEN
    RAISE EXCEPTION 'Target department % not available', p_to_department_id;
  END IF;

  -- A review returns to the same doctor; a forward transfer to a service
  -- point clears the doctor (service queues are per-department, not per-doctor).
  v_doctor := CASE
    WHEN p_restore_doctor OR p_to_stage = 'review' THEN v_token.doctor_id
    WHEN v_dept.type = 'opd' THEN v_token.doctor_id
    ELSE NULL
  END;

  UPDATE public.hospital_tokens
     SET department_id = p_to_department_id,
         doctor_id     = v_doctor,
         stage         = p_to_stage,
         status        = 'waiting',
         room_id       = NULL,
         called_at     = NULL,
         joined_at     = now()
   WHERE id = p_token_id
  RETURNING * INTO v_token;

  INSERT INTO public.hospital_token_events
    (customer_id, branch_id, token_id, department_id, doctor_id, actor,
     from_status, to_status, from_stage, to_stage, token_code, message)
  VALUES
    (v_token.customer_id, v_token.branch_id, v_token.id, p_to_department_id, v_doctor, p_actor,
     'served', 'waiting', v_token.stage, p_to_stage, v_token.token_code,
     v_token.token_code || ' → ' || public.loc(v_dept.name, 'en') || ' (' || p_to_stage || ')');

  RETURN v_token;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: get_hospital_board — one round trip per TV
-- ══════════════════════════════════════════════════════════════
-- ONE ROW PER OPEN ROOM, always visible, showing that room's current token or
-- nothing — not "the last N tokens called", which would make a quiet room
-- vanish three calls later. Plus a recently-served strip, per-department
-- waiting counts, doctor-on-leave / delayed indicators, branding, and the
-- ads/ticker cascade copied from get_school_board.
--
-- PRIVACY: returns token codes and room/doctor labels only — never joins
-- hospital_patients. The board must not be able to leak a name.
CREATE OR REPLACE FUNCTION public.get_hospital_board(p_screen_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen   public.screens;
  v_branch   public.branches;
  v_customer public.customers;
  v_settings public.hospital_settings;
  v_date     date;
  v_rooms    json;
  v_recent   json;
  v_depts    json;
  v_ads      json;
  v_tickers  json;
BEGIN
  SELECT * INTO v_screen
    FROM public.screens WHERE screen_token = p_screen_token AND is_active AND kind = 'hospital';

  IF v_screen.id IS NULL THEN
    RETURN json_build_object('status', 'not-found');
  END IF;

  -- Presence heartbeat (the board is the only thing that ever touches the TV).
  UPDATE public.screens SET last_seen_at = now() WHERE id = v_screen.id;

  SELECT * INTO v_branch   FROM public.branches  WHERE id = v_screen.branch_id;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_screen.customer_id;

  IF NOT v_customer.is_active
     OR (v_customer.plan_expires_at IS NOT NULL AND v_customer.plan_expires_at < now()) THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_settings FROM public.hospital_settings WHERE branch_id = v_branch.id;
  v_date := public.hospital_service_date(v_branch.id);

  -- One row per open room, with whatever it is currently calling. Doctor name
  -- and room label are staff identity, not patient PII, so both may show.
  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.display_order, r.label), '[]'::json)
    INTO v_rooms
    FROM (
      SELECT rm.id, rm.label, rm.display_order, rm.is_open, rm.last_seen_at,
             d.id            AS department_id,
             public.loc(d.name, 'en') AS department_en,
             d.name          AS department_name,
             d.type          AS department_type,
             d.color         AS department_color,
             doc.name        AS doctor_name,
             doc.id IS NULL  AS doctor_missing,
             (EXISTS (SELECT 1 FROM public.hospital_doctor_leaves lv
                       WHERE lv.doctor_id = rm.current_doctor_id
                         AND lv.leave_date = v_date)) AS doctor_on_leave,
             t.id            AS token_id,
             t.token_code,
             t.called_at,
             t.recall_count,
             t.priority_category,
             t.stage
        FROM public.hospital_rooms rm
        LEFT JOIN public.hospital_departments d ON d.id = rm.department_id
        LEFT JOIN public.hospital_doctors doc ON doc.id = rm.current_doctor_id
        LEFT JOIN public.hospital_tokens t
               ON t.room_id = rm.id
              AND t.status = 'called'
              AND t.service_date = v_date
       WHERE rm.branch_id = v_branch.id AND rm.is_active
    ) r;

  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.served_at DESC), '[]'::json)
    INTO v_recent
    FROM (
      SELECT t.token_code, t.served_at, rm.label AS room_label
        FROM public.hospital_tokens t
        LEFT JOIN public.hospital_rooms rm ON rm.id = t.room_id
       WHERE t.branch_id = v_branch.id
         AND t.service_date = v_date
         AND t.status = 'served'
       ORDER BY t.served_at DESC
       LIMIT 8
    ) r;

  SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.display_order), '[]'::json)
    INTO v_depts
    FROM (
      SELECT d.id, public.loc(d.name, 'en') AS name_en, d.name, d.color, d.type, d.display_order,
             count(t.id) FILTER (WHERE t.status = 'waiting') AS waiting
        FROM public.hospital_departments d
        LEFT JOIN public.hospital_tokens t
               ON t.department_id = d.id AND t.service_date = v_date
       WHERE d.branch_id = v_branch.id AND d.is_active
       GROUP BY d.id
    ) r;

  -- Ads: screen override wins, else branch + customer merged per branch_ad_mode.
  -- Same cascade as get_school_board — kept in sync deliberately.
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
    'hospitalName', coalesce(nullif(public.loc(coalesce(v_settings.hospital_name, '{}'::jsonb), 'en'), ''), v_customer.business_name),
    'hospitalNameI18n', coalesce(v_settings.hospital_name, '{}'::jsonb),
    'logoUrl',     coalesce(nullif(v_settings.logo_url, ''), v_customer.logo_url),
    'primaryColor', v_customer.primary_color,
    'announcementLang', v_screen.announcement_lang,
    'announceLocales',  coalesce(v_settings.languages, ARRAY['en']),
    'announceEnabled',  coalesce(v_settings.announce_enabled, true),
    'announceTemplateI18n', coalesce(v_settings.announce_template, '{}'::jsonb),
    'showClock',   v_screen.show_clock,
    'tickerText',  v_branch.ticker_text,
    'rooms',       v_rooms,
    'recent',      v_recent,
    'departments', v_depts,
    'ads',         coalesce(v_ads, '[]'::json),
    'tickers',     coalesce(v_tickers, '[]'::json)
  );
END;
$$;


-- Billable add-on (distributor grant) for the public QR tracking page. Added
-- BEFORE get_hospital_ticket_status below, which reads it.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS hospital_public_tracking_enabled boolean NOT NULL DEFAULT true;

-- ══════════════════════════════════════════════════════════════
-- RPC: get_public_ticket_status — the QR on a printed ticket
-- ══════════════════════════════════════════════════════════════
-- Answers "where do I stand right now" for one non-enumerable public code.
-- Mirrors the school RPC (20260902 + 20260906) with hospital fields: doctor /
-- room in place of counter, stage in place of nothing. Gated on the same
-- distributor grant AND the branch's own switch. NO patient PII is returned.
CREATE OR REPLACE FUNCTION public.get_hospital_ticket_status(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token    public.hospital_tokens;
  v_dept     public.hospital_departments;
  v_branch   public.branches;
  v_customer public.customers;
  v_settings public.hospital_settings;
  v_room     public.hospital_rooms;
  v_doctor   public.hospital_doctors;
  v_today    date;
  v_is_today boolean;
  v_enabled  boolean;
  v_waiting_ahead int;
  v_now_serving text;
  v_hospital_name text;
  v_pace_count int;
  v_pace_min timestamptz;
  v_pace_max timestamptz;
  v_avg_gap_secs numeric;
  v_eta_secs numeric;
BEGIN
  SELECT * INTO v_token FROM public.hospital_tokens WHERE public_code = p_code;
  IF v_token.id IS NULL THEN
    RETURN json_build_object('status', 'not-found');
  END IF;

  SELECT * INTO v_branch   FROM public.branches  WHERE id = v_token.branch_id;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_token.customer_id;
  SELECT * INTO v_settings FROM public.hospital_settings WHERE branch_id = v_branch.id;
  SELECT * INTO v_dept     FROM public.hospital_departments WHERE id = v_token.department_id;

  IF NOT v_customer.is_active
     OR (v_customer.plan_expires_at IS NOT NULL AND v_customer.plan_expires_at < now()) THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  v_enabled := coalesce(v_customer.hospital_public_tracking_enabled, true)
               AND coalesce(v_settings.public_tracking_enabled, true);
  IF NOT v_enabled THEN
    RETURN json_build_object('status', 'disabled');
  END IF;

  v_today := public.hospital_service_date(v_branch.id);
  v_is_today := (v_token.service_date = v_today);

  -- Same predicate as the ticket's countWaitingAhead: waiting/held in this
  -- queue that joined earlier. The queue is the DOCTOR for OPD, the
  -- DEPARTMENT for service points.
  IF v_token.doctor_id IS NOT NULL THEN
    SELECT count(*) INTO v_waiting_ahead
      FROM public.hospital_tokens
     WHERE doctor_id = v_token.doctor_id AND service_date = v_token.service_date
       AND status IN ('waiting','held') AND joined_at < v_token.joined_at;
  ELSE
    SELECT count(*) INTO v_waiting_ahead
      FROM public.hospital_tokens
     WHERE department_id = v_token.department_id AND service_date = v_token.service_date
       AND status IN ('waiting','held') AND joined_at < v_token.joined_at;
  END IF;

  IF v_token.room_id IS NOT NULL AND v_token.status = 'called' THEN
    SELECT * INTO v_room FROM public.hospital_rooms WHERE id = v_token.room_id;
  END IF;
  IF v_token.doctor_id IS NOT NULL THEN
    SELECT * INTO v_doctor FROM public.hospital_doctors WHERE id = v_token.doctor_id;
  END IF;

  -- Now-serving for this queue + a pace-based ETA (last 10 calls).
  IF v_token.doctor_id IS NOT NULL THEN
    SELECT token_code INTO v_now_serving FROM public.hospital_tokens
     WHERE doctor_id = v_token.doctor_id AND service_date = v_token.service_date
       AND status = 'called' ORDER BY called_at DESC LIMIT 1;
    SELECT count(*), min(called_at), max(called_at) INTO v_pace_count, v_pace_min, v_pace_max
      FROM (SELECT called_at FROM public.hospital_tokens
             WHERE doctor_id = v_token.doctor_id AND service_date = v_token.service_date
               AND called_at IS NOT NULL ORDER BY called_at DESC LIMIT 10) s;
  ELSE
    SELECT token_code INTO v_now_serving FROM public.hospital_tokens
     WHERE department_id = v_token.department_id AND service_date = v_token.service_date
       AND status = 'called' ORDER BY called_at DESC LIMIT 1;
    SELECT count(*), min(called_at), max(called_at) INTO v_pace_count, v_pace_min, v_pace_max
      FROM (SELECT called_at FROM public.hospital_tokens
             WHERE department_id = v_token.department_id AND service_date = v_token.service_date
               AND called_at IS NOT NULL ORDER BY called_at DESC LIMIT 10) s;
  END IF;

  IF v_pace_count >= 3 AND v_pace_max > v_pace_min THEN
    v_avg_gap_secs := extract(epoch from (v_pace_max - v_pace_min)) / (v_pace_count - 1);
  ELSE
    v_avg_gap_secs := coalesce(v_doctor.avg_consult_minutes, 10) * 60;
  END IF;
  v_eta_secs := v_waiting_ahead * v_avg_gap_secs;

  v_hospital_name := coalesce(
    nullif(public.loc(coalesce(v_settings.hospital_name, '{}'::jsonb), 'en'), ''),
    v_customer.business_name);

  RETURN json_build_object(
    'status', 'ok',
    'hospitalName', v_hospital_name,
    'hospitalNameI18n', coalesce(v_settings.hospital_name, '{}'::jsonb) || jsonb_build_object('en', v_hospital_name),
    'logoUrl', coalesce(nullif(v_settings.logo_url, ''), v_customer.logo_url),
    'languages', coalesce(v_settings.languages, ARRAY['en']),
    'locale', v_token.locale,
    'tokenCode', v_token.token_code,
    'tokenStatus', v_token.status,
    'stage', v_token.stage,
    'priorityCategory', v_token.priority_category,
    'joinedAt', v_token.joined_at,
    'calledAt', v_token.called_at,
    'departmentName', coalesce(v_dept.name, '{}'::jsonb),
    'departmentNameEn', public.loc(coalesce(v_dept.name, '{}'::jsonb), 'en'),
    'departmentType', v_dept.type,
    'roomLabel', v_room.label,
    'doctorName', v_doctor.name,
    'serviceDate', v_token.service_date,
    'isToday', v_is_today,
    'waitingAhead', v_waiting_ahead,
    'nowServingCode', v_now_serving,
    'etaSeconds', round(v_eta_secs),
    'paceSampleCount', v_pace_count
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- Grants — service_role only. Nothing here is reachable from a browser
-- session: the device surfaces authenticate with branch/screen/room tokens
-- resolved server-side via the service client.
-- ══════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.hospital_service_date(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_hospital_token(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_next_hospital_token(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_hospital_token(uuid, uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hospital_board(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hospital_ticket_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gen_hospital_public_code() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hospital_service_date(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_hospital_token(uuid, uuid, uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.call_next_hospital_token(uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_hospital_token(uuid, uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_hospital_board(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_hospital_ticket_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gen_hospital_public_code() TO service_role;
