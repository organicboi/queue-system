'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireBranchManager } from '@/lib/dal/session'
import {
  getHospitalDepartmentQuota, getHospitalRoomQuota, quotaReachedMessage,
} from '@/lib/dal/hospital-limits'
import {
  toHospitalDepartmentDTO, toHospitalDoctorDTO, toHospitalDoctorScheduleDTO,
  toHospitalDoctorLeaveDTO, toHospitalRoomDTO, toHospitalSettingsDTO,
  type HospitalDepartmentDTO, type HospitalDoctorDTO, type HospitalDoctorScheduleDTO,
  type HospitalDoctorLeaveDTO, type HospitalRoomDTO, type HospitalSettingsDTO,
  type DbHospitalDepartment, type DbHospitalDoctor, type DbHospitalDoctorSchedule,
  type DbHospitalDoctorLeave, type DbHospitalRoom, type DbHospitalSettings,
} from '@/lib/db/hospital-types'
import { createPairingCode } from '@/lib/dal/device-pairing'
import { coerceLocales, regionLocales, type LocaleMap } from '@/lib/region'
import { HOSPITAL_DEPARTMENT_COLORS } from '@/lib/hospital/constants'
import type { ProfileDTO } from '@/lib/db/types'

// ── Locale-map form helpers ───────────────────────────────────
// Hospital content columns are jsonb-native (no legacy `_en` / `_ar` scalar to
// dual-write, unlike the school tables). A translatable field renders one
// `<input name="${field}_${locale}">` per regionLocales() entry; `en` is forced
// present because it is every surface's fallback.
function localeMapFromForm(fd: FormData, field: string): LocaleMap {
  const out: Record<string, string> = {}
  for (const l of regionLocales()) {
    const v = (fd.get(`${field}_${l}`) ?? '').toString().trim()
    if (v) out[l] = v
  }
  if (!out.en) out.en = ((fd.get(`${field}_en`) ?? fd.get(field)) ?? '').toString().trim()
  return out as LocaleMap
}

function localeMapSchema(max: number, requiredMsg: string) {
  return z
    .record(z.string(), z.string().max(max))
    .transform((m) => {
      const out: Record<string, string> = {}
      for (const l of regionLocales()) {
        const v = (m[l] ?? '').trim()
        if (v) out[l] = v
      }
      if (!out.en) out.en = (m.en ?? '').trim()
      return out as LocaleMap
    })
    .refine((m) => !!m.en, requiredMsg)
}

type Guard =
  | { ok: true; profile: ProfileDTO }
  | { ok: false; error: string }

async function guard(branchId: string): Promise<Guard> {
  try {
    return { ok: true, profile: await requireBranchManager(branchId) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Access denied' }
  }
}

// ══════════════════════════════════════════════════════════════
// Departments
// ══════════════════════════════════════════════════════════════
export interface HospitalDepartmentResult {
  department?: HospitalDepartmentDTO
  error?: string
}

const DEPARTMENT_TYPES = ['opd', 'lab', 'radiology', 'pharmacy', 'billing', 'triage'] as const

const DepartmentSchema = z.object({
  branchId: z.string().uuid(),
  name: localeMapSchema(100, 'Department name is required'),
  prefix: z.string().regex(/^[A-Za-z]{1,3}$/, 'Prefix must be 1–3 letters'),
  type: z.enum(DEPARTMENT_TYPES).default('opd'),
  numberStart: z.coerce.number().int().min(1).max(99999).default(101),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(HOSPITAL_DEPARTMENT_COLORS[0]),
  icon: z.string().max(40).default('Stethoscope'),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
})

function departmentInputFromForm(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    name: localeMapFromForm(formData, 'name'),
    prefix: formData.get('prefix'),
    type: formData.get('type') || 'opd',
    numberStart: formData.get('numberStart') || 101,
    color: formData.get('color') || HOSPITAL_DEPARTMENT_COLORS[0],
    icon: formData.get('icon') || 'Stethoscope',
    displayOrder: formData.get('displayOrder') || 0,
  }
}

export async function createHospitalDepartmentAction(
  _prev: HospitalDepartmentResult,
  formData: FormData
): Promise<HospitalDepartmentResult> {
  const parsed = DepartmentSchema.safeParse(departmentInputFromForm(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }
  const { profile } = g

  const dq = await getHospitalDepartmentQuota(profile.customerId, parsed.data.branchId)
  if (dq.remaining <= 0) return { error: quotaReachedMessage('department', dq.limit) }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_departments')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      name: parsed.data.name,
      prefix: parsed.data.prefix.toUpperCase(),
      type: parsed.data.type,
      number_start: parsed.data.numberStart,
      color: parsed.data.color,
      icon: parsed.data.icon,
      display_order: parsed.data.displayOrder,
    })
    .select()
    .single()

  // The partial unique index (branch_id, prefix) WHERE is_active catches a
  // duplicate rather than a read-then-write check — no race between two admins.
  if (error?.code === '23505') {
    return { error: `Prefix ${parsed.data.prefix.toUpperCase()} is already used by another active department` }
  }
  if (error || !data) return { error: 'Could not create the department' }

  revalidatePath('/hospital/departments')
  return { department: toHospitalDepartmentDTO(data as DbHospitalDepartment) }
}

export async function updateHospitalDepartmentAction(
  departmentId: string,
  branchId: string,
  patch: Partial<{
    name: LocaleMap; prefix: string; type: (typeof DEPARTMENT_TYPES)[number]
    numberStart: number; color: string; icon: string; displayOrder: number; isActive: boolean
  }>
): Promise<HospitalDepartmentResult> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  // Reactivating spends a slot exactly as creating does.
  if (patch.isActive === true) {
    const dq = await getHospitalDepartmentQuota(g.profile.customerId, branchId)
    if (dq.remaining <= 0) return { error: quotaReachedMessage('department', dq.limit) }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_departments')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.prefix !== undefined && { prefix: patch.prefix.toUpperCase() }),
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.numberStart !== undefined && { number_start: patch.numberStart }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.displayOrder !== undefined && { display_order: patch.displayOrder }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', departmentId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That prefix is already in use' }
  if (error || !data) return { error: 'Could not update the department' }

  revalidatePath('/hospital/departments')
  return { department: toHospitalDepartmentDTO(data as DbHospitalDepartment) }
}

const EditDepartmentSchema = DepartmentSchema.extend({ departmentId: z.string().uuid() })

export async function editHospitalDepartmentAction(
  _prev: HospitalDepartmentResult,
  formData: FormData
): Promise<HospitalDepartmentResult> {
  const parsed = EditDepartmentSchema.safeParse({
    ...departmentInputFromForm(formData),
    departmentId: formData.get('departmentId'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  return updateHospitalDepartmentAction(d.departmentId, d.branchId, {
    name: d.name, prefix: d.prefix, type: d.type, numberStart: d.numberStart,
    color: d.color, icon: d.icon,
  })
}

export async function deactivateHospitalDepartmentAction(departmentId: string, branchId: string) {
  return updateHospitalDepartmentAction(departmentId, branchId, { isActive: false })
}

export interface DeleteHospitalDepartmentResult {
  deleted?: boolean
  tokenCount?: number
  error?: string
}

// hospital_tokens.department_id is ON DELETE RESTRICT — a department that has
// issued a token stays for the records; the answer then is to deactivate it.
export async function deleteHospitalDepartmentAction(
  departmentId: string,
  branchId: string
): Promise<DeleteHospitalDepartmentResult> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data: dept } = await supabase
    .from('hospital_departments')
    .select('id')
    .eq('id', departmentId)
    .eq('branch_id', branchId)
    .maybeSingle()
  if (!dept) return { error: 'Unknown department' }

  const { count } = await supabase
    .from('hospital_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', departmentId)

  if ((count ?? 0) > 0) {
    return {
      tokenCount: count ?? 0,
      error:
        `This department has already issued ${count} token${count === 1 ? '' : 's'}, ` +
        'so it has to stay for the records. Deactivate it instead — it disappears from ' +
        'the kiosk and the board, and frees its prefix.',
    }
  }

  const { error } = await supabase
    .from('hospital_departments')
    .delete()
    .eq('id', departmentId)
    .eq('branch_id', branchId)

  if (error) return { error: 'Could not delete the department' }

  revalidatePath('/hospital/departments')
  revalidatePath('/hospital/doctors')
  revalidatePath('/hospital/rooms')
  return { deleted: true }
}

export async function reorderHospitalDepartmentsAction(
  branchId: string,
  orderedIds: string[]
): Promise<{ error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  if (orderedIds.length === 0) return {}
  if (orderedIds.length > 200) return { error: 'Too many departments to reorder' }

  const supabase = createSupabaseServiceClient()
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('hospital_departments')
        .update({ display_order: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('branch_id', branchId)
    )
  )
  if (results.some((r) => r.error)) return { error: 'Could not save the new order' }

  revalidatePath('/hospital/departments')
  return {}
}

// ── Seed the standard OPD + service-point set ─────────────────
const DEFAULT_DEPARTMENTS: {
  nameEn: string; prefix: string; type: (typeof DEPARTMENT_TYPES)[number]; icon: string; color: string
}[] = [
  { nameEn: 'Registration',      prefix: 'R', type: 'triage',    icon: 'UserPlus',     color: '#4338CA' },
  { nameEn: 'General Medicine',   prefix: 'GM', type: 'opd',      icon: 'Stethoscope',  color: '#0F766E' },
  { nameEn: 'Orthopaedics',       prefix: 'OR', type: 'opd',      icon: 'Bone',         color: '#B45309' },
  { nameEn: 'Paediatrics',        prefix: 'PD', type: 'opd',      icon: 'Baby',         color: '#BE185D' },
  { nameEn: 'ENT',                prefix: 'EN', type: 'opd',      icon: 'Ear',          color: '#7C3AED' },
  { nameEn: 'Ophthalmology',      prefix: 'EY', type: 'opd',      icon: 'Eye',          color: '#0E7490' },
  { nameEn: 'Laboratory',         prefix: 'LB', type: 'lab',      icon: 'Microscope',   color: '#15803D' },
  { nameEn: 'Radiology',          prefix: 'XR', type: 'radiology', icon: 'ScanLine',    color: '#1D4ED8' },
  { nameEn: 'Pharmacy',           prefix: 'PH', type: 'pharmacy', icon: 'Pill',         color: '#C2410C' },
  { nameEn: 'Billing',            prefix: 'BL', type: 'billing',  icon: 'Receipt',      color: '#475569' },
]

export async function seedHospitalDepartmentsAction(
  branchId: string
): Promise<{ created?: number; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  const { profile } = g

  const supabase = createSupabaseServiceClient()
  const { data: existing } = await supabase
    .from('hospital_departments')
    .select('prefix')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  const dq = await getHospitalDepartmentQuota(profile.customerId, branchId)
  if (dq.remaining <= 0) return { error: quotaReachedMessage('department', dq.limit) }

  const taken = new Set(((existing ?? []) as { prefix: string }[]).map((d) => d.prefix))
  const rows = DEFAULT_DEPARTMENTS
    .filter((d) => !taken.has(d.prefix))
    .slice(0, dq.remaining)
    .map((d, i) => ({
      customer_id: profile.customerId,
      branch_id: branchId,
      name: { en: d.nameEn } as LocaleMap,
      prefix: d.prefix,
      type: d.type,
      color: d.color,
      icon: d.icon,
      display_order: i + 1,
    }))

  if (rows.length === 0) return { created: 0 }

  const { error } = await supabase.from('hospital_departments').insert(rows)
  if (error) return { error: 'Could not add the default departments' }

  revalidatePath('/hospital/departments')
  return { created: rows.length }
}

// ══════════════════════════════════════════════════════════════
// Doctors
// ══════════════════════════════════════════════════════════════
export interface HospitalDoctorResult {
  doctor?: HospitalDoctorDTO
  error?: string
}

const DoctorSchema = z.object({
  branchId: z.string().uuid(),
  departmentId: z.string().uuid('Pick a department'),
  name: z.string().min(1, 'Doctor name is required').max(120),
  specialization: z.string().max(120).default(''),
  feeRupees: z.coerce.number().min(0).max(100000).default(0),
  avgConsultMinutes: z.coerce.number().int().min(1).max(120).default(10),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
})

function doctorInputFromForm(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    departmentId: formData.get('departmentId'),
    name: formData.get('name'),
    specialization: formData.get('specialization') || '',
    feeRupees: formData.get('feeRupees') || 0,
    avgConsultMinutes: formData.get('avgConsultMinutes') || 10,
    displayOrder: formData.get('displayOrder') || 0,
  }
}

async function assertOpdDepartment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, departmentId: string, branchId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('hospital_departments')
    .select('type, branch_id, is_active')
    .eq('id', departmentId)
    .maybeSingle()
  const d = data as { type: string; branch_id: string; is_active: boolean } | null
  if (!d || d.branch_id !== branchId || !d.is_active) return 'That department is not available at this branch'
  if (d.type !== 'opd') return 'Doctors can only be added to an OPD department'
  return null
}

export async function createHospitalDoctorAction(
  _prev: HospitalDoctorResult,
  formData: FormData
): Promise<HospitalDoctorResult> {
  const parsed = DoctorSchema.safeParse(doctorInputFromForm(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const deptErr = await assertOpdDepartment(supabase, parsed.data.departmentId, parsed.data.branchId)
  if (deptErr) return { error: deptErr }

  const { data, error } = await supabase
    .from('hospital_doctors')
    .insert({
      customer_id: g.profile.customerId,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      name: parsed.data.name.trim(),
      specialization: parsed.data.specialization.trim(),
      fee_paise: Math.round(parsed.data.feeRupees * 100),
      avg_consult_minutes: parsed.data.avgConsultMinutes,
      display_order: parsed.data.displayOrder,
    })
    .select()
    .single()

  if (error || !data) return { error: 'Could not create the doctor' }

  revalidatePath('/hospital/doctors')
  return { doctor: toHospitalDoctorDTO(data as DbHospitalDoctor) }
}

export async function updateHospitalDoctorAction(
  doctorId: string,
  branchId: string,
  patch: Partial<{
    departmentId: string; name: string; specialization: string
    feeRupees: number; avgConsultMinutes: number; displayOrder: number; isActive: boolean
  }>
): Promise<HospitalDoctorResult> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  if (patch.departmentId !== undefined) {
    const deptErr = await assertOpdDepartment(supabase, patch.departmentId, branchId)
    if (deptErr) return { error: deptErr }
  }

  const { data, error } = await supabase
    .from('hospital_doctors')
    .update({
      ...(patch.departmentId !== undefined && { department_id: patch.departmentId }),
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.specialization !== undefined && { specialization: patch.specialization.trim() }),
      ...(patch.feeRupees !== undefined && { fee_paise: Math.round(patch.feeRupees * 100) }),
      ...(patch.avgConsultMinutes !== undefined && { avg_consult_minutes: patch.avgConsultMinutes }),
      ...(patch.displayOrder !== undefined && { display_order: patch.displayOrder }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', doctorId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error || !data) return { error: 'Could not update the doctor' }

  revalidatePath('/hospital/doctors')
  return { doctor: toHospitalDoctorDTO(data as DbHospitalDoctor) }
}

const EditDoctorSchema = DoctorSchema.extend({ doctorId: z.string().uuid() })

export async function editHospitalDoctorAction(
  _prev: HospitalDoctorResult,
  formData: FormData
): Promise<HospitalDoctorResult> {
  const parsed = EditDoctorSchema.safeParse({
    ...doctorInputFromForm(formData),
    doctorId: formData.get('doctorId'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  return updateHospitalDoctorAction(d.doctorId, d.branchId, {
    departmentId: d.departmentId, name: d.name, specialization: d.specialization,
    feeRupees: d.feeRupees, avgConsultMinutes: d.avgConsultMinutes,
  })
}

export async function deactivateHospitalDoctorAction(doctorId: string, branchId: string) {
  return updateHospitalDoctorAction(doctorId, branchId, { isActive: false })
}

// ── Doctor schedules ─────────────────────────────────────────
// A doctor with no schedule row for today does not appear on the kiosk. The
// whole weekly grid is replaced in one call: the client sends every row it
// wants to keep.
const ScheduleRowSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  session: z.enum(['am', 'pm']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.coerce.number().int().min(1).max(120).default(15),
  maxTokens: z.coerce.number().int().min(1).max(500).default(40),
})

export async function setHospitalDoctorScheduleAction(
  doctorId: string,
  branchId: string,
  rows: z.input<typeof ScheduleRowSchema>[]
): Promise<{ schedules?: HospitalDoctorScheduleDTO[]; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const parsed = z.array(ScheduleRowSchema).max(14).safeParse(rows)
  if (!parsed.success) return { error: 'One of the schedule rows is invalid' }
  for (const r of parsed.data) {
    if (r.endTime <= r.startTime) return { error: 'Each session must end after it starts' }
  }

  const supabase = createSupabaseServiceClient()
  const { data: doctor } = await supabase
    .from('hospital_doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('branch_id', branchId)
    .maybeSingle()
  if (!doctor) return { error: 'Unknown doctor' }

  await supabase.from('hospital_doctor_schedules').delete().eq('doctor_id', doctorId)

  if (parsed.data.length === 0) {
    revalidatePath('/hospital/doctors')
    return { schedules: [] }
  }

  const { data, error } = await supabase
    .from('hospital_doctor_schedules')
    .insert(parsed.data.map((r) => ({
      customer_id: g.profile.customerId,
      doctor_id: doctorId,
      weekday: r.weekday,
      session: r.session,
      start_time: r.startTime,
      end_time: r.endTime,
      slot_minutes: r.slotMinutes,
      max_tokens: r.maxTokens,
    })))
    .select()

  if (error?.code === '23505') return { error: 'Two rows target the same weekday and session' }
  if (error || !data) return { error: 'Could not save the schedule' }

  revalidatePath('/hospital/doctors')
  return { schedules: (data as DbHospitalDoctorSchedule[]).map(toHospitalDoctorScheduleDTO) }
}

// ── Doctor leaves ────────────────────────────────────────────
export async function addHospitalDoctorLeaveAction(
  doctorId: string,
  branchId: string,
  leaveDate: string,
  reason: string
): Promise<{ leave?: HospitalDoctorLeaveDTO; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) return { error: 'Pick a valid date' }

  const supabase = createSupabaseServiceClient()
  const { data: doctor } = await supabase
    .from('hospital_doctors')
    .select('id')
    .eq('id', doctorId)
    .eq('branch_id', branchId)
    .maybeSingle()
  if (!doctor) return { error: 'Unknown doctor' }

  const { data, error } = await supabase
    .from('hospital_doctor_leaves')
    .insert({
      customer_id: g.profile.customerId,
      doctor_id: doctorId,
      leave_date: leaveDate,
      reason: reason.trim().slice(0, 200),
    })
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That day is already marked' }
  if (error || !data) return { error: 'Could not mark the leave' }

  revalidatePath('/hospital/doctors')
  return { leave: toHospitalDoctorLeaveDTO(data as DbHospitalDoctorLeave) }
}

export async function removeHospitalDoctorLeaveAction(
  leaveId: string,
  branchId: string
): Promise<{ removed?: boolean; error?: string }> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  // Scope the delete to a leave whose doctor belongs to this branch.
  const { data: leave } = await supabase
    .from('hospital_doctor_leaves')
    .select('id, doctor_id, hospital_doctors!inner(branch_id)')
    .eq('id', leaveId)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchOfLeave = (leave as any)?.hospital_doctors?.branch_id
  if (!leave || branchOfLeave !== branchId) return { error: 'Unknown leave' }

  const { error } = await supabase.from('hospital_doctor_leaves').delete().eq('id', leaveId)
  if (error) return { error: 'Could not remove the leave' }

  revalidatePath('/hospital/doctors')
  return { removed: true }
}

// ══════════════════════════════════════════════════════════════
// Rooms
// ══════════════════════════════════════════════════════════════
export interface HospitalRoomResult {
  room?: HospitalRoomDTO
  error?: string
}

const RoomSchema = z.object({
  branchId: z.string().uuid(),
  departmentId: z.string().uuid('Pick a department'),
  label: z.string().min(1, 'A room label is required').max(60),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
})

async function assertBranchDepartment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, departmentId: string, branchId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('hospital_departments')
    .select('branch_id, is_active')
    .eq('id', departmentId)
    .maybeSingle()
  const d = data as { branch_id: string; is_active: boolean } | null
  if (!d || d.branch_id !== branchId || !d.is_active) return 'That department is not available at this branch'
  return null
}

export async function createHospitalRoomAction(
  _prev: HospitalRoomResult,
  formData: FormData
): Promise<HospitalRoomResult> {
  const parsed = RoomSchema.safeParse({
    branchId: formData.get('branchId'),
    departmentId: formData.get('departmentId'),
    label: formData.get('label'),
    displayOrder: formData.get('displayOrder') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }

  const rq = await getHospitalRoomQuota(g.profile.customerId, parsed.data.branchId)
  if (rq.remaining <= 0) return { error: quotaReachedMessage('room', rq.limit) }

  const supabase = createSupabaseServiceClient()
  const deptErr = await assertBranchDepartment(supabase, parsed.data.departmentId, parsed.data.branchId)
  if (deptErr) return { error: deptErr }

  const { data, error } = await supabase
    .from('hospital_rooms')
    .insert({
      customer_id: g.profile.customerId,
      branch_id: parsed.data.branchId,
      department_id: parsed.data.departmentId,
      label: parsed.data.label.trim(),
      display_order: parsed.data.displayOrder,
    })
    .select()
    .single()

  if (error?.code === '23505') return { error: 'A room with that label already exists at this branch' }
  if (error || !data) return { error: 'Could not create the room' }

  revalidatePath('/hospital/rooms')
  return { room: toHospitalRoomDTO(data as DbHospitalRoom) }
}

export async function updateHospitalRoomAction(
  roomId: string,
  branchId: string,
  patch: Partial<{
    label: string; departmentId: string; displayOrder: number
    currentDoctorId: string | null; isOpen: boolean; isActive: boolean
  }>
): Promise<HospitalRoomResult> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const rq = patch.isActive === true
    ? await getHospitalRoomQuota(g.profile.customerId, branchId)
    : null
  if (rq && rq.remaining <= 0) return { error: quotaReachedMessage('room', rq.limit) }

  const supabase = createSupabaseServiceClient()
  if (patch.departmentId !== undefined) {
    const deptErr = await assertBranchDepartment(supabase, patch.departmentId, branchId)
    if (deptErr) return { error: deptErr }
  }
  // A room can only seat a doctor from its own OPD department.
  if (patch.currentDoctorId) {
    const { data: room } = await supabase
      .from('hospital_rooms').select('department_id').eq('id', roomId).eq('branch_id', branchId).maybeSingle()
    const { data: doc } = await supabase
      .from('hospital_doctors')
      .select('department_id, is_active')
      .eq('id', patch.currentDoctorId)
      .eq('branch_id', branchId)
      .maybeSingle()
    const d = doc as { department_id: string; is_active: boolean } | null
    const r = room as { department_id: string } | null
    if (!d || !d.is_active || !r || d.department_id !== r.department_id) {
      return { error: 'That doctor does not belong to this room’s department' }
    }
  }

  const { data, error } = await supabase
    .from('hospital_rooms')
    .update({
      ...(patch.label !== undefined && { label: patch.label.trim() }),
      ...(patch.departmentId !== undefined && { department_id: patch.departmentId }),
      ...(patch.displayOrder !== undefined && { display_order: patch.displayOrder }),
      ...(patch.currentDoctorId !== undefined && { current_doctor_id: patch.currentDoctorId }),
      ...(patch.isOpen !== undefined && { is_open: patch.isOpen }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error?.code === '23505') return { error: 'A room with that label already exists at this branch' }
  if (error || !data) return { error: 'Could not update the room' }

  revalidatePath('/hospital/rooms')
  return { room: toHospitalRoomDTO(data as DbHospitalRoom) }
}

const EditRoomSchema = RoomSchema.extend({ roomId: z.string().uuid() })

export async function editHospitalRoomAction(
  _prev: HospitalRoomResult,
  formData: FormData
): Promise<HospitalRoomResult> {
  const parsed = EditRoomSchema.safeParse({
    roomId: formData.get('roomId'),
    branchId: formData.get('branchId'),
    departmentId: formData.get('departmentId'),
    label: formData.get('label'),
    displayOrder: formData.get('displayOrder') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  return updateHospitalRoomAction(d.roomId, d.branchId, {
    label: d.label, departmentId: d.departmentId,
  })
}

export async function deactivateHospitalRoomAction(roomId: string, branchId: string) {
  return updateHospitalRoomAction(roomId, branchId, { isActive: false, isOpen: false })
}

export async function regenerateHospitalRoomTokenAction(
  roomId: string,
  branchId: string
): Promise<HospitalRoomResult> {
  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_rooms')
    .update({ room_token: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error || !data) return { error: 'Could not regenerate the room link' }

  revalidatePath('/hospital/rooms')
  return { room: toHospitalRoomDTO(data as DbHospitalRoom) }
}

// ══════════════════════════════════════════════════════════════
// Settings
// ══════════════════════════════════════════════════════════════
export interface HospitalSettingsResult {
  settings?: HospitalSettingsDTO
  error?: string
}

// Identity (hospital name + logo) is deliberately absent: it brands the board
// and every ticket, so it belongs to whoever sold the system — the distributor
// sets it, not the tenant. Leaving the fields out of the schema is what
// enforces that, since this is a public entry point.
const SettingsSchema = z.object({
  branchId: z.string().uuid(),
  languages: z
    .array(z.string())
    .min(1)
    .optional()
    .transform((v) => (v ? coerceLocales(v).slice(0, 3) : undefined)),
  ticketFooter: z.record(z.string(), z.string().max(200)).optional(),
  announceTemplate: z.record(z.string(), z.string().max(200)).optional(),
  kioskIdleSeconds: z.coerce.number().int().min(3).max(120).optional(),
  priorityEnabled: z.boolean().optional(),
  priorityGraceMinutes: z.coerce.number().int().min(0).max(120).optional(),
  announceEnabled: z.boolean().optional(),
  printEnabled: z.boolean().optional(),
  apptWalkinRatio: z.coerce.number().int().min(1).max(20).optional(),
  followupFreeDays: z.coerce.number().int().min(0).max(90).optional(),
  patientDataRetentionDays: z.coerce.number().int().min(0).max(3650).nullable().optional(),
  publicTrackingEnabled: z.boolean().optional(),
  timezone: z.string().max(60).optional(),
  dayStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

function trimMap(map: Record<string, string> | undefined): LocaleMap | undefined {
  if (map === undefined) return undefined
  const out: Record<string, string> = {}
  for (const l of regionLocales()) {
    const v = (map[l] ?? '').trim()
    if (v) out[l] = v
  }
  out.en = (map.en ?? out.en ?? '').trim()
  return out as LocaleMap
}

// Upsert: a hospital branch has no settings row until someone opens this page
// (unless onboarding seeded one), and the kiosk/board both need one.
export async function saveHospitalSettingsAction(
  input: z.input<typeof SettingsSchema>
): Promise<HospitalSettingsResult> {
  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const g = await guard(parsed.data.branchId)
  if (!g.ok) return { error: g.error }
  const d = parsed.data

  const ticketFooter = trimMap(d.ticketFooter)
  const announceTemplate = trimMap(d.announceTemplate)

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('hospital_settings')
    .upsert({
      customer_id: g.profile.customerId,
      branch_id: d.branchId,
      // hospital_name has a NOT NULL + `? 'en'` check; on an insert (no row yet)
      // seed it so the upsert can't violate the constraint.
      ...(await seedNameIfMissing(supabase, d.branchId, g.profile.businessName)),
      ...(d.languages !== undefined && { languages: d.languages }),
      ...(ticketFooter !== undefined && { ticket_footer: ticketFooter }),
      ...(announceTemplate !== undefined && { announce_template: announceTemplate }),
      ...(d.kioskIdleSeconds !== undefined && { kiosk_idle_seconds: d.kioskIdleSeconds }),
      ...(d.priorityEnabled !== undefined && { priority_enabled: d.priorityEnabled }),
      ...(d.priorityGraceMinutes !== undefined && { priority_grace_minutes: d.priorityGraceMinutes }),
      ...(d.announceEnabled !== undefined && { announce_enabled: d.announceEnabled }),
      ...(d.printEnabled !== undefined && { print_enabled: d.printEnabled }),
      ...(d.apptWalkinRatio !== undefined && { appt_walkin_ratio: d.apptWalkinRatio }),
      ...(d.followupFreeDays !== undefined && { followup_free_days: d.followupFreeDays }),
      ...(d.patientDataRetentionDays !== undefined && { patient_data_retention_days: d.patientDataRetentionDays }),
      ...(d.publicTrackingEnabled !== undefined && { public_tracking_enabled: d.publicTrackingEnabled }),
      ...(d.timezone !== undefined && { timezone: d.timezone }),
      ...(d.dayStartTime !== undefined && { day_start_time: d.dayStartTime }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id' })
    .select()
    .single()

  if (error || !data) return { error: 'Could not save settings' }

  revalidatePath('/hospital/settings')
  return { settings: toHospitalSettingsDTO(data as DbHospitalSettings) }
}

async function seedNameIfMissing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, branchId: string, fallback: string | null | undefined
): Promise<{ hospital_name?: LocaleMap }> {
  const { data } = await supabase
    .from('hospital_settings')
    .select('id')
    .eq('branch_id', branchId)
    .maybeSingle()
  if (data) return {}
  return { hospital_name: { en: (fallback ?? 'Hospital').trim() || 'Hospital' } as LocaleMap }
}

// ══════════════════════════════════════════════════════════════
// TV screens (shared `screens` table; kind = 'hospital')
// ══════════════════════════════════════════════════════════════
export async function createHospitalScreenAction(
  _prev: { error?: string; screenToken?: string },
  formData: FormData
): Promise<{ error?: string; screenToken?: string }> {
  const branchId = String(formData.get('branchId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!branchId || !name) return { error: 'Screen name is required' }

  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()

  const { count } = await supabase
    .from('screens')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  const { data: planData } = await supabase
    .from('customers')
    .select('plans(max_screens_per_branch)')
    .eq('id', g.profile.customerId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxScreens = (planData as any)?.plans?.max_screens_per_branch ?? 2
  if ((count ?? 0) >= maxScreens) {
    return { error: `You have reached the maximum number of screens (${maxScreens}) for this branch on your plan.` }
  }

  const { data, error } = await supabase
    .from('screens')
    .insert({
      customer_id: g.profile.customerId,
      branch_id: branchId,
      name,
      kind: 'hospital',
      orientation: 'landscape',
    })
    .select('screen_token')
    .single()

  if (error || !data) return { error: 'Could not create the screen' }

  revalidatePath('/hospital/screens')
  return { screenToken: (data as { screen_token: string }).screen_token }
}

// ── Device pairing codes ──────────────────────────────────────
// Same short-lived 6-digit → real-token swap the school vertical uses (see
// lib/dal/device-pairing.ts + app/api/pair/route.ts). The kiosk tablet and the
// waiting-area TV have no keyboard and no camera; the installer types this
// number into the app's setup wizard once. `redeemPairingCode` derives the
// vertical from the branch's customer / the screen's `kind`, so the app knows
// to open the /hospital/* route set.
export async function createHospitalDevicePairingCodeAction(input: {
  branchId: string
  role: 'kiosk' | 'display'
  screenId?: string
}): Promise<{ code?: string; expiresAt?: string; error?: string }> {
  const { branchId, role, screenId } = input
  if (role !== 'kiosk' && role !== 'display') return { error: 'Invalid device role' }
  if (role === 'display' && !screenId) return { error: 'A screen is required' }

  const g = await guard(branchId)
  if (!g.ok) return { error: g.error }

  const supabase = createSupabaseServiceClient()
  if (role === 'display') {
    // The screen must be a hospital board on this same branch.
    const { data: screen } = await supabase
      .from('screens')
      .select('id')
      .eq('id', screenId!)
      .eq('branch_id', branchId)
      .eq('kind', 'hospital')
      .maybeSingle()
    if (!screen) return { error: 'Unknown screen' }
  }

  try {
    const { code, expiresAt } = await createPairingCode({
      customerId: g.profile.customerId,
      branchId,
      role,
      screenId: screenId ?? null,
      createdBy: g.profile.id,
    })
    return { code, expiresAt }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create a pairing code' }
  }
}
