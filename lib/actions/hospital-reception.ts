'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireBranchManager } from '@/lib/dal/session'
import {
  searchHospitalPatients, getHospitalPatientDetail, getHospitalServiceDate,
  getHospitalAppointmentsForDate,
  type HospitalPatientDetail,
} from '@/lib/dal/hospital'
import {
  toHospitalPatientDTO, toHospitalTokenDTO, toHospitalAppointmentDTO,
  type HospitalPatientDTO, type HospitalTokenDTO,
  type HospitalAppointmentDTO, type HospitalAppointmentListItemDTO,
  type DbHospitalPatient, type DbHospitalToken, type DbHospitalAppointment,
} from '@/lib/db/hospital-types'
import type { ProfileDTO } from '@/lib/db/types'

type Guard = { ok: true; profile: ProfileDTO } | { ok: false; error: string }
async function guard(branchId: string): Promise<Guard> {
  try {
    return { ok: true, profile: await requireBranchManager(branchId) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Access denied' }
  }
}

const PRIORITY = ['senior', 'emergency', 'pregnant', 'differently-abled']

// ── Search ───────────────────────────────────────────────────
export async function searchHospitalPatientsAction(
  branchId: string,
  query: string
): Promise<{ patients?: HospitalPatientDTO[]; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  const patients = await searchHospitalPatients(g.profile.customerId, query, g.profile.id)
  return { patients }
}

// ── Detail ───────────────────────────────────────────────────
export async function getHospitalPatientDetailAction(
  branchId: string,
  patientId: string
): Promise<{ detail?: HospitalPatientDetail; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  const detail = await getHospitalPatientDetail(g.profile.customerId, patientId, g.profile.id)
  if (!detail) return { error: 'Unknown patient' }
  return { detail }
}

// ── Register ─────────────────────────────────────────────────
const RegisterSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1, 'Patient name is required').max(120),
  phone: z.string().max(20).default(''),
  uhid: z.string().max(40).optional().default(''),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  abhaNumber: z.string().max(40).optional().default(''),
  consent: z.boolean().refine((v) => v, 'Consent is required to register a patient (DPDP Act 2023)'),
})

function generateUhid(): string {
  // The hospital's own UHID goes in the form field when they have one; this is
  // the fallback. Unique-per-customer is enforced by the DB — a rare collision
  // surfaces as a retryable error rather than a silent overwrite.
  return 'UH' + Date.now().toString(36).toUpperCase().slice(-6) +
    Math.floor(Math.random() * 36).toString(36).toUpperCase()
}

export async function registerHospitalPatientAction(
  _prev: { patient?: HospitalPatientDTO; error?: string },
  formData: FormData
): Promise<{ patient?: HospitalPatientDTO; error?: string }> {
  const parsed = RegisterSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    uhid: formData.get('uhid') ?? '',
    dob: formData.get('dob') ?? '',
    gender: formData.get('gender') || undefined,
    abhaNumber: formData.get('abhaNumber') ?? '',
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }
  const d = parsed.data

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_patients')
    .insert({
      customer_id: g.profile.customerId,
      uhid: (d.uhid || '').trim() || generateUhid(),
      name: d.name.trim(),
      phone: d.phone.trim(),
      dob: d.dob || null,
      gender: d.gender ?? null,
      abha_number: (d.abhaNumber || '').trim() || null,
      consent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That UHID is already in use — try again or enter a different one' }
  if (error || !data) return { error: 'Could not register the patient' }

  revalidatePath('/hospital/patients')
  return { patient: toHospitalPatientDTO(data as DbHospitalPatient) }
}

// ── Issue a token on behalf of a patient ─────────────────────
// The escape hatch the kiosk can't be: elderly and assisted patients get a
// token handed to them at the desk. Creates (or reuses) the patient's active
// visit for this branch, then goes through claim_hospital_token so the series
// stays gapless and the daily reset stays free.
export async function receptionIssueTokenAction(input: {
  branchId: string
  patientId: string
  departmentId: string
  doctorId?: string | null
  priorityCategory?: string | null
  visitType?: 'new' | 'followup'
}): Promise<{ token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(input.branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()

  const { data: patient } = await supabase
    .from('hospital_patients')
    .select('id, is_active')
    .eq('id', input.patientId)
    .eq('customer_id', g.profile.customerId)
    .maybeSingle()
  if (!patient) return { error: 'Unknown patient' }
  if (!(patient as { is_active: boolean }).is_active) {
    return { error: 'This patient record is inactive — reactivate it before issuing a token' }
  }

  const serviceDate = await getHospitalServiceDate(input.branchId)

  // Reuse the one active visit per (patient, branch), or open one.
  const { data: activeVisit } = await supabase
    .from('hospital_visits')
    .select('id')
    .eq('patient_id', input.patientId)
    .eq('branch_id', input.branchId)
    .eq('status', 'active')
    .maybeSingle()

  let visitId = (activeVisit as { id: string } | null)?.id
  if (!visitId) {
    const { data: newVisit, error: visitErr } = await supabase
      .from('hospital_visits')
      .insert({
        customer_id: g.profile.customerId,
        branch_id: input.branchId,
        patient_id: input.patientId,
        visit_date: serviceDate,
        type: input.visitType ?? 'new',
      })
      .select('id')
      .single()
    if (visitErr || !newVisit) return { error: 'Could not open a visit' }
    visitId = (newVisit as { id: string }).id
  }

  const { data, error } = await supabase.rpc('claim_hospital_token', {
    p_branch_id: input.branchId,
    p_department_id: input.departmentId,
    p_doctor_id: input.doctorId ?? null,
    p_visit_id: visitId,
    p_source: 'reception',
    p_priority_category:
      input.priorityCategory && PRIORITY.includes(input.priorityCategory) ? input.priorityCategory : null,
  })

  if (error || !data) {
    return { error: error?.message?.replace(/^.*:\s*/, '') || 'Could not issue a token' }
  }

  revalidatePath('/hospital/patients')
  return { token: toHospitalTokenDTO(data as DbHospitalToken) }
}

// ── Reception amendments ─────────────────────────────────────
async function loadBranchToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, branchId: string, tokenId: string
): Promise<DbHospitalToken | null> {
  const serviceDate = await supabase.rpc('hospital_service_date', { p_branch_id: branchId })
  const { data } = await supabase
    .from('hospital_tokens')
    .select('*')
    .eq('id', tokenId)
    .eq('branch_id', branchId)
    .eq('service_date', serviceDate.data as string)
    .maybeSingle()
  return (data as DbHospitalToken | null) ?? null
}

export async function receptionCancelTokenAction(
  branchId: string,
  tokenId: string
): Promise<{ token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const row = await loadBranchToken(supabase, branchId, tokenId)
  if (!row) return { error: 'That token was not issued today' }
  if (row.status === 'served' || row.status === 'cancelled') {
    return { error: `${row.token_code} is already ${row.status}` }
  }

  const { data, error } = await supabase
    .from('hospital_tokens')
    .update({ status: 'cancelled', room_id: null })
    .eq('id', row.id)
    .select()
    .single()
  if (error || !data) return { error: `Could not cancel ${row.token_code}` }

  await supabase.from('hospital_token_events').insert({
    customer_id: row.customer_id, branch_id: branchId, token_id: row.id,
    department_id: row.department_id, doctor_id: row.doctor_id, actor: 'reception',
    from_status: row.status, to_status: 'cancelled', token_code: row.token_code,
    message: `${row.token_code} cancelled at reception`,
  })

  revalidatePath('/hospital/patients')
  return { token: toHospitalTokenDTO(data as DbHospitalToken) }
}

// A patient who missed their call and came back — put them back in the pool
// with a fresh joined_at so they are not instantly next but do not lose the day.
export async function receptionRejoinTokenAction(
  branchId: string,
  tokenId: string
): Promise<{ token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const row = await loadBranchToken(supabase, branchId, tokenId)
  if (!row) return { error: 'That token was not issued today' }
  if (row.status !== 'no-show') return { error: `${row.token_code} is not a no-show` }

  const { data, error } = await supabase
    .from('hospital_tokens')
    .update({ status: 'waiting', room_id: null, called_at: null, joined_at: new Date().toISOString() })
    .eq('id', row.id)
    .select()
    .single()
  if (error || !data) return { error: `Could not rejoin ${row.token_code}` }

  await supabase.from('hospital_token_events').insert({
    customer_id: row.customer_id, branch_id: branchId, token_id: row.id,
    department_id: row.department_id, doctor_id: row.doctor_id, actor: 'reception',
    from_status: 'no-show', to_status: 'waiting', to_stage: row.stage, token_code: row.token_code,
    message: `${row.token_code} rejoined the queue at reception`,
  })

  revalidatePath('/hospital/patients')
  return { token: toHospitalTokenDTO(data as DbHospitalToken) }
}

// ── Patient edit / deactivate ─────────────────────────────────
const UpdatePatientSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  name: z.string().min(1, 'Patient name is required').max(120),
  phone: z.string().max(20).default(''),
  uhid: z.string().min(1, 'UHID is required').max(40),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  abhaNumber: z.string().max(40).optional().default(''),
})

export async function updateHospitalPatientAction(
  _prev: { patient?: HospitalPatientDTO; error?: string },
  formData: FormData
): Promise<{ patient?: HospitalPatientDTO; error?: string }> {
  const parsed = UpdatePatientSchema.safeParse({
    branchId: formData.get('branchId'),
    patientId: formData.get('patientId'),
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    uhid: formData.get('uhid') ?? '',
    dob: formData.get('dob') ?? '',
    gender: formData.get('gender') || undefined,
    abhaNumber: formData.get('abhaNumber') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }
  const d = parsed.data

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_patients')
    .update({
      uhid: d.uhid.trim(),
      name: d.name.trim(),
      phone: d.phone.trim(),
      dob: d.dob || null,
      gender: d.gender ?? null,
      abha_number: (d.abhaNumber || '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.patientId)
    .eq('customer_id', g.profile.customerId)
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That UHID is already in use by another patient' }
  if (error || !data) return { error: 'Could not update the patient' }

  await supabase.from('hospital_patient_access_logs').insert({
    customer_id: g.profile.customerId, patient_id: d.patientId, accessed_by: g.profile.id, reason: 'reception-edit',
  })

  revalidatePath('/hospital/patients')
  return { patient: toHospitalPatientDTO(data as DbHospitalPatient) }
}

// Soft-delete: the record and its visit/token history stay put (tokens and
// visits FK to it, several ON DELETE CASCADE — hard-deleting a patient would
// wipe real queue history along with a mistaken entry). Deactivating just
// hides them from new bookings; reactivate undoes it.
async function setHospitalPatientActive(
  branchId: string,
  patientId: string,
  isActive: boolean
): Promise<{ patient?: HospitalPatientDTO; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_patients')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', patientId)
    .eq('customer_id', g.profile.customerId)
    .select()
    .single()

  if (error || !data) return { error: `Could not ${isActive ? 'reactivate' : 'deactivate'} the patient` }

  revalidatePath('/hospital/patients')
  return { patient: toHospitalPatientDTO(data as DbHospitalPatient) }
}

export async function deactivateHospitalPatientAction(branchId: string, patientId: string) {
  return setHospitalPatientActive(branchId, patientId, false)
}
export async function reactivateHospitalPatientAction(branchId: string, patientId: string) {
  return setHospitalPatientActive(branchId, patientId, true)
}

// ── Appointments (advance booking — token issued at booking time) ───
// See supabase/migrations/20260909_hospital_appointments_crud.sql: the token
// is created now, dated to the appointment's own service_date, off the same
// gapless per-department cursor the kiosk uses — so a walk-in issued once
// that date becomes "today" continues straight on from these.
export async function bookHospitalAppointmentAction(input: {
  branchId: string
  patientId: string
  departmentId: string
  doctorId: string
  slotLocal: string // "YYYY-MM-DDTHH:mm:00", branch wall-clock — never an offset/instant
  priorityCategory?: string | null
  feePaise?: number | null
}): Promise<{ appointment?: HospitalAppointmentDTO; token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(input.branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('book_hospital_appointment', {
    p_branch_id: input.branchId,
    p_patient_id: input.patientId,
    p_department_id: input.departmentId,
    p_doctor_id: input.doctorId,
    p_slot_local: input.slotLocal,
    p_priority_category:
      input.priorityCategory && PRIORITY.includes(input.priorityCategory) ? input.priorityCategory : null,
    p_booked_via: 'reception',
    p_fee_paise: input.feePaise ?? null,
  })

  if (error || !data) {
    return { error: error?.message?.replace(/^.*:\s*/, '') || 'Could not book the appointment' }
  }

  const result = data as { appointment: DbHospitalAppointment; token: DbHospitalToken }
  revalidatePath('/hospital/patients')
  return {
    appointment: toHospitalAppointmentDTO(result.appointment),
    token: toHospitalTokenDTO(result.token),
  }
}

export async function rescheduleHospitalAppointmentAction(input: {
  branchId: string
  appointmentId: string
  departmentId: string
  doctorId: string
  slotLocal: string
  priorityCategory?: string | null
  feePaise?: number | null
}): Promise<{ appointment?: HospitalAppointmentDTO; token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(input.branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('reschedule_hospital_appointment', {
    p_branch_id: input.branchId,
    p_appointment_id: input.appointmentId,
    p_department_id: input.departmentId,
    p_doctor_id: input.doctorId,
    p_slot_local: input.slotLocal,
    p_priority_category:
      input.priorityCategory && PRIORITY.includes(input.priorityCategory) ? input.priorityCategory : null,
    p_fee_paise: input.feePaise ?? null,
  })

  if (error || !data) {
    return { error: error?.message?.replace(/^.*:\s*/, '') || 'Could not reschedule the appointment' }
  }

  const result = data as { appointment: DbHospitalAppointment; token: DbHospitalToken }
  revalidatePath('/hospital/patients')
  return {
    appointment: toHospitalAppointmentDTO(result.appointment),
    token: toHospitalTokenDTO(result.token),
  }
}

export async function cancelHospitalAppointmentAction(
  branchId: string,
  appointmentId: string
): Promise<{ appointment?: HospitalAppointmentDTO; token?: HospitalTokenDTO; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('cancel_hospital_appointment', {
    p_branch_id: branchId,
    p_appointment_id: appointmentId,
  })

  if (error || !data) {
    return { error: error?.message?.replace(/^.*:\s*/, '') || 'Could not cancel the appointment' }
  }

  const result = data as { appointment: DbHospitalAppointment; token: DbHospitalToken | null }
  revalidatePath('/hospital/patients')
  return {
    appointment: toHospitalAppointmentDTO(result.appointment),
    token: result.token ? toHospitalTokenDTO(result.token) : undefined,
  }
}

export async function getHospitalAppointmentsForDateAction(
  branchId: string,
  serviceDate: string
): Promise<{ items?: HospitalAppointmentListItemDTO[]; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  const items = await getHospitalAppointmentsForDate(branchId, serviceDate)
  return { items }
}
