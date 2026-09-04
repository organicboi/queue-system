-- ══════════════════════════════════════════════════════════════
-- Hospital appointments — reception CRUD + advance token issuance
-- ══════════════════════════════════════════════════════════════
-- hospital_appointments shipped in 20260908_hospital_queue_system.sql as a
-- "Phase 2 surface" — the table existed but nothing wrote to it, and a token
-- was only ever created at check-in (same day). Reception now books an
-- appointment for a future service_date and the token is issued at booking
-- time, not check-in — so the day's series (hospital_department_days) already
-- carries those numbers before the kiosk opens, and a walk-in issued once
-- that date becomes "today" continues the same series rather than starting
-- over. book_hospital_appointment / reschedule_hospital_appointment reuse the
-- exact cursor upsert claim_hospital_token uses, keyed the same way.
--
-- Two correctness fixes bundled in, both because a token can now be created
-- long before the day it queues on:
--
-- 1. p_slot_local is `timestamp` (no time zone), not `timestamptz`. It is the
--    appointment's wall-clock time AT THE BRANCH — "9:30 on the 6th", not an
--    instant. Neither the receptionist's browser nor the Vercel server
--    necessarily run in the branch's timezone, so resolving that string to an
--    instant happens once, here, against hospital_settings.timezone — the
--    same source hospital_service_date() already trusts. Passing a
--    pre-computed timestamptz from JS would silently bake in whichever
--    timezone the browser or server process happened to be in.
--
-- 2. joined_at is call_next_hospital_token's ordering key (effective-wait),
--    which assumed every token's joined_at was "now" — true for a
--    kiosk/check-in token, false for one booked days ahead. Stamping
--    joined_at = now() on a token booked in advance would make it look like
--    the oldest-waiting token for its entire service_date, permanently
--    jumping every same-day walk-in regardless of the appt_walkin_ratio
--    interleave. Both functions below stamp joined_at = the resolved slot
--    instant instead, so an appointment queues where its slot actually falls
--    in the day, same as a walk-in queues at its arrival time.

-- Soft-delete: patient rows are DPDP-consented records with tokens, visits and
-- access logs hanging off them (several ON DELETE CASCADE) — a hard delete
-- would erase real visit history along with the mistake. "Delete" from
-- reception means deactivate; the record and its history stay intact and can
-- be reactivated.
ALTER TABLE public.hospital_patients
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS hospital_patients_customer_active_idx
  ON public.hospital_patients(customer_id) WHERE is_active;


-- ══════════════════════════════════════════════════════════════
-- RPC: book_hospital_appointment — reception books ahead, token issued now
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.book_hospital_appointment(
  p_branch_id         uuid,
  p_patient_id        uuid,
  p_department_id     uuid,
  p_doctor_id         uuid,
  p_slot_local        timestamp,
  p_priority_category text    DEFAULT NULL,
  p_booked_via        text    DEFAULT 'reception',
  p_fee_paise         int     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept   public.hospital_departments;
  v_doctor public.hospital_doctors;
  v_tz     text;
  v_slot   timestamptz;
  v_date   date;
  v_dow    int;
  v_number int;
  v_appt   public.hospital_appointments;
  v_token  public.hospital_tokens;
BEGIN
  SELECT * INTO v_dept FROM public.hospital_departments
   WHERE id = p_department_id AND branch_id = p_branch_id AND is_active;
  IF v_dept.id IS NULL THEN
    RAISE EXCEPTION 'Department % is not an active department of branch %', p_department_id, p_branch_id;
  END IF;
  IF v_dept.type <> 'opd' THEN
    RAISE EXCEPTION 'Appointments can only be booked into an OPD department';
  END IF;

  SELECT * INTO v_doctor FROM public.hospital_doctors
   WHERE id = p_doctor_id AND branch_id = p_branch_id AND department_id = p_department_id AND is_active;
  IF v_doctor.id IS NULL THEN
    RAISE EXCEPTION 'That doctor is not active in this department';
  END IF;

  SELECT coalesce(s.timezone, 'Asia/Kolkata') INTO v_tz
    FROM public.hospital_settings s WHERE s.branch_id = p_branch_id;
  v_tz := coalesce(v_tz, 'Asia/Kolkata');
  v_slot := p_slot_local AT TIME ZONE v_tz;
  v_date := p_slot_local::date;

  IF v_date < public.hospital_service_date(p_branch_id) THEN
    RAISE EXCEPTION 'Cannot book an appointment for a date that has already passed';
  END IF;

  v_dow := extract(dow from v_date)::int;
  IF NOT EXISTS (
    SELECT 1 FROM public.hospital_doctor_schedules
    WHERE doctor_id = p_doctor_id AND weekday = v_dow
  ) THEN
    RAISE EXCEPTION 'Doctor has no schedule at this department on that day';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.hospital_doctor_leaves
    WHERE doctor_id = p_doctor_id AND leave_date = v_date
  ) THEN
    RAISE EXCEPTION 'Doctor is on leave that day';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.hospital_patients
    WHERE id = p_patient_id AND NOT is_active
  ) THEN
    RAISE EXCEPTION 'This patient record is inactive — reactivate it before booking';
  END IF;

  INSERT INTO public.hospital_appointments
    (customer_id, branch_id, doctor_id, patient_id, slot_time, booked_via, fee_paise, status)
  VALUES
    (v_dept.customer_id, p_branch_id, p_doctor_id, p_patient_id, v_slot, p_booked_via,
     coalesce(p_fee_paise, v_doctor.fee_paise), 'booked')
  RETURNING * INTO v_appt;

  -- Same gapless per-(department, day) cursor claim_hospital_token uses: the
  -- first booking for a date that doesn't exist yet starts at number_start,
  -- so the receptionist's first advance booking for tomorrow is tomorrow's #1
  -- (well, number_start) — and the kiosk continues this exact row once that
  -- date becomes "today".
  INSERT INTO public.hospital_department_days
    (customer_id, branch_id, department_id, service_date, next_number)
  VALUES
    (v_dept.customer_id, p_branch_id, p_department_id, v_date, v_dept.number_start + 1)
  ON CONFLICT (department_id, service_date) DO UPDATE
    SET next_number = hospital_department_days.next_number + 1
  RETURNING next_number - 1 INTO v_number;

  INSERT INTO public.hospital_tokens
    (customer_id, branch_id, department_id, doctor_id, service_date, number, token_code,
     stage, status, priority_category, source, appointment_id, joined_at)
  VALUES
    (v_dept.customer_id, p_branch_id, p_department_id, p_doctor_id, v_date, v_number,
     v_dept.prefix || v_number::text, 'consult', 'waiting', p_priority_category, 'appointment',
     v_appt.id, v_slot)
  RETURNING * INTO v_token;

  INSERT INTO public.hospital_token_events
    (customer_id, branch_id, token_id, department_id, doctor_id, actor,
     to_status, to_stage, token_code, message)
  VALUES
    (v_dept.customer_id, p_branch_id, v_token.id, p_department_id, p_doctor_id, 'reception',
     'waiting', v_token.stage, v_token.token_code,
     v_token.token_code || ' booked for ' || v_date::text || ' — ' || public.loc(v_dept.name, 'en'));

  RETURN jsonb_build_object('appointment', to_jsonb(v_appt), 'token', to_jsonb(v_token));
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: cancel_hospital_appointment
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cancel_hospital_appointment(
  p_branch_id      uuid,
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt  public.hospital_appointments;
  v_token public.hospital_tokens;
BEGIN
  SELECT * INTO v_appt FROM public.hospital_appointments
   WHERE id = p_appointment_id AND branch_id = p_branch_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.status = 'cancelled' THEN RAISE EXCEPTION 'Appointment is already cancelled'; END IF;

  SELECT * INTO v_token FROM public.hospital_tokens WHERE appointment_id = p_appointment_id;

  IF v_token.id IS NOT NULL THEN
    IF v_token.status = 'served' THEN
      RAISE EXCEPTION 'Cannot cancel — % has already been served', v_token.token_code;
    END IF;
    IF v_token.status <> 'cancelled' THEN
      UPDATE public.hospital_tokens
         SET status = 'cancelled', room_id = NULL
       WHERE id = v_token.id
       RETURNING * INTO v_token;

      INSERT INTO public.hospital_token_events
        (customer_id, branch_id, token_id, department_id, doctor_id, actor, to_status, token_code, message)
      VALUES
        (v_token.customer_id, p_branch_id, v_token.id, v_token.department_id, v_token.doctor_id, 'reception',
         'cancelled', v_token.token_code, v_token.token_code || ' cancelled — appointment cancelled at reception');
    END IF;
  END IF;

  UPDATE public.hospital_appointments
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_appointment_id
   RETURNING * INTO v_appt;

  RETURN jsonb_build_object('appointment', to_jsonb(v_appt), 'token', to_jsonb(v_token));
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- RPC: reschedule_hospital_appointment — full reschedule (date/doctor/time)
-- ══════════════════════════════════════════════════════════════
-- Same department + doctor + service_date as the current token: the edit is
-- in place (slot time, priority) — no renumbering. Anything else moves the
-- token to the new department/day's series: the old one is cancelled and
-- detached (appointment_id cleared — hospital_tokens_one_per_appointment only
-- allows one live link per appointment) and a fresh one issued the same way
-- booking does.
CREATE OR REPLACE FUNCTION public.reschedule_hospital_appointment(
  p_branch_id         uuid,
  p_appointment_id    uuid,
  p_department_id     uuid,
  p_doctor_id         uuid,
  p_slot_local        timestamp,
  p_priority_category text DEFAULT NULL,
  p_fee_paise         int  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt      public.hospital_appointments;
  v_old       public.hospital_tokens;
  v_dept      public.hospital_departments;
  v_doctor    public.hospital_doctors;
  v_tz        text;
  v_slot      timestamptz;
  v_date      date;
  v_dow       int;
  v_number    int;
  v_token     public.hospital_tokens;
  v_same_slot boolean;
BEGIN
  SELECT * INTO v_appt FROM public.hospital_appointments
   WHERE id = p_appointment_id AND branch_id = p_branch_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.status = 'cancelled' THEN RAISE EXCEPTION 'Cannot reschedule a cancelled appointment'; END IF;

  SELECT * INTO v_old FROM public.hospital_tokens WHERE appointment_id = p_appointment_id;
  IF v_old.id IS NOT NULL AND v_old.status = 'served' THEN
    RAISE EXCEPTION 'Cannot reschedule — % has already been served', v_old.token_code;
  END IF;

  SELECT * INTO v_dept FROM public.hospital_departments
   WHERE id = p_department_id AND branch_id = p_branch_id AND is_active;
  IF v_dept.id IS NULL THEN RAISE EXCEPTION 'Department is not active'; END IF;
  IF v_dept.type <> 'opd' THEN RAISE EXCEPTION 'Appointments can only be booked into an OPD department'; END IF;

  SELECT * INTO v_doctor FROM public.hospital_doctors
   WHERE id = p_doctor_id AND branch_id = p_branch_id AND department_id = p_department_id AND is_active;
  IF v_doctor.id IS NULL THEN RAISE EXCEPTION 'That doctor is not active in this department'; END IF;

  SELECT coalesce(s.timezone, 'Asia/Kolkata') INTO v_tz
    FROM public.hospital_settings s WHERE s.branch_id = p_branch_id;
  v_tz := coalesce(v_tz, 'Asia/Kolkata');
  v_slot := p_slot_local AT TIME ZONE v_tz;
  v_date := p_slot_local::date;

  IF v_date < public.hospital_service_date(p_branch_id) THEN
    RAISE EXCEPTION 'Cannot reschedule to a date that has already passed';
  END IF;

  v_dow := extract(dow from v_date)::int;
  IF NOT EXISTS (SELECT 1 FROM public.hospital_doctor_schedules WHERE doctor_id = p_doctor_id AND weekday = v_dow) THEN
    RAISE EXCEPTION 'Doctor has no schedule at this department on that day';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hospital_doctor_leaves WHERE doctor_id = p_doctor_id AND leave_date = v_date) THEN
    RAISE EXCEPTION 'Doctor is on leave that day';
  END IF;

  v_same_slot := v_old.id IS NOT NULL
    AND v_old.department_id = p_department_id
    AND v_old.doctor_id = p_doctor_id
    AND v_old.service_date = v_date;

  UPDATE public.hospital_appointments
     SET doctor_id = p_doctor_id, slot_time = v_slot,
         fee_paise = coalesce(p_fee_paise, fee_paise), updated_at = now()
   WHERE id = p_appointment_id
   RETURNING * INTO v_appt;

  IF v_same_slot THEN
    UPDATE public.hospital_tokens
       SET priority_category = p_priority_category, joined_at = v_slot
     WHERE id = v_old.id
     RETURNING * INTO v_token;
  ELSE
    IF v_old.id IS NOT NULL AND v_old.status <> 'cancelled' THEN
      UPDATE public.hospital_tokens
         SET status = 'cancelled', room_id = NULL, appointment_id = NULL
       WHERE id = v_old.id;

      INSERT INTO public.hospital_token_events
        (customer_id, branch_id, token_id, department_id, doctor_id, actor, to_status, token_code, message)
      VALUES
        (v_old.customer_id, p_branch_id, v_old.id, v_old.department_id, v_old.doctor_id, 'reception',
         'cancelled', v_old.token_code, v_old.token_code || ' cancelled — rescheduled');
    END IF;

    INSERT INTO public.hospital_department_days
      (customer_id, branch_id, department_id, service_date, next_number)
    VALUES
      (v_dept.customer_id, p_branch_id, p_department_id, v_date, v_dept.number_start + 1)
    ON CONFLICT (department_id, service_date) DO UPDATE
      SET next_number = hospital_department_days.next_number + 1
    RETURNING next_number - 1 INTO v_number;

    INSERT INTO public.hospital_tokens
      (customer_id, branch_id, department_id, doctor_id, service_date, number, token_code,
       stage, status, priority_category, source, appointment_id, joined_at)
    VALUES
      (v_dept.customer_id, p_branch_id, p_department_id, p_doctor_id, v_date, v_number,
       v_dept.prefix || v_number::text, 'consult', 'waiting', p_priority_category, 'appointment',
       p_appointment_id, v_slot)
    RETURNING * INTO v_token;

    INSERT INTO public.hospital_token_events
      (customer_id, branch_id, token_id, department_id, doctor_id, actor, to_status, to_stage, token_code, message)
    VALUES
      (v_dept.customer_id, p_branch_id, v_token.id, p_department_id, p_doctor_id, 'reception',
       'waiting', v_token.stage, v_token.token_code,
       v_token.token_code || ' booked for ' || v_date::text || ' — rescheduled');
  END IF;

  RETURN jsonb_build_object('appointment', to_jsonb(v_appt), 'token', to_jsonb(v_token));
END;
$$;
