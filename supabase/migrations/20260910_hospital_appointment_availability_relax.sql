-- ══════════════════════════════════════════════════════════════
-- Relax future-dated appointment booking: drop the weekly-schedule block
-- ══════════════════════════════════════════════════════════════
-- book_hospital_appointment / reschedule_hospital_appointment (20260909)
-- rejected any doctor with no hospital_doctor_schedules row for the target
-- weekday — "Doctor has no schedule at this department on that day". That
-- weekly grid is a rough recurring-shift sketch (see HospitalDoctorsManager's
-- schedule editor), not a promise the doctor is never in on any other day —
-- covering shifts, one-off clinics and un-entered schedules all hit this and
-- got reported to reception as "doctor not available" days in advance, for a
-- doctor who may well be in. Verifying a doctor's actual availability on a
-- future date is reception's job, not a database constraint's.
--
-- The leave-day block stays: a hospital_doctor_leaves row is a specific,
-- deliberate fact reception itself recorded for that exact date, unlike the
-- generic weekly pattern — still worth hard-stopping on.

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

  -- No weekly-schedule check here — see migration header. Leave is still a
  -- hard stop: it is a specific fact for this exact date, reception's own.
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

  -- No weekly-schedule check here — see migration header. Leave is still a
  -- hard stop: it is a specific fact for this exact date, reception's own.
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
