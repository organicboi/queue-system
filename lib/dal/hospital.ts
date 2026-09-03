import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toHospitalSettingsDTO, toHospitalDepartmentDTO, toHospitalDoctorDTO,
  toHospitalDoctorScheduleDTO, toHospitalDoctorLeaveDTO, toHospitalRoomDTO,
  toHospitalPatientDTO, toHospitalVisitDTO, toHospitalTokenDTO,
  toHospitalTokenEventDTO,
  type HospitalSettingsDTO, type HospitalDepartmentDTO, type HospitalDoctorDTO,
  type HospitalRoomDTO, type HospitalPatientDTO, type HospitalVisitDTO,
  type HospitalTokenDTO, type HospitalTokenEventDTO, type HospitalBoardPacket,
  type HospitalDashboardStats, type HospitalDepartmentStats, type HospitalKioskFeed,
  type HospitalTicketStatus,
  type DbHospitalSettings, type DbHospitalDepartment, type DbHospitalDoctor,
  type DbHospitalDoctorSchedule, type DbHospitalDoctorLeave, type DbHospitalRoom,
  type DbHospitalPatient, type DbHospitalVisit,
  type DbHospitalToken, type DbHospitalTokenEvent,
} from '@/lib/db/hospital-types'
import { HOSPITAL_TOKEN_PAGE_SIZE } from '@/lib/hospital/constants'
import { getHospitalPublicTrackingEnabled } from '@/lib/dal/hospital-limits'
import type { PublicTicketStatus } from '@/lib/db/school-types'

// Reads use the service-role client and rely on the requireX() guards in
// lib/dal/session.ts — RLS in this schema is self-referentially broken, so the
// hospital tables follow the same service-role-only rule as the school/counters
// tables.

// ── Service date ──────────────────────────────────────────────
// Always ask Postgres. Deriving "today" in JS is what makes a dashboard
// disagree with the data after local midnight or before UTC midnight.
export const getHospitalServiceDate = cache(async (branchId: string): Promise<string> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.rpc('hospital_service_date', { p_branch_id: branchId })
  return (data as string | null) ?? new Date().toISOString().slice(0, 10)
})

// ── Settings ──────────────────────────────────────────────────
export const getHospitalSettings = cache(async (branchId: string): Promise<HospitalSettingsDTO | null> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_settings')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle()

  return data ? toHospitalSettingsDTO(data as DbHospitalSettings) : null
})

// ── Departments ───────────────────────────────────────────────
export const getHospitalDepartments = cache(async (
  branchId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<HospitalDepartmentDTO[]> => {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('hospital_departments')
    .select('*')
    .eq('branch_id', branchId)

  if (opts.activeOnly) query = query.eq('is_active', true)

  const { data } = await query
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (data as DbHospitalDepartment[] ?? []).map(toHospitalDepartmentDTO)
})

// ── Doctors ───────────────────────────────────────────────────
export const getHospitalDoctors = cache(async (
  branchId: string,
  opts: { activeOnly?: boolean; withSchedules?: boolean } = {}
): Promise<HospitalDoctorDTO[]> => {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('hospital_doctors')
    .select('*')
    .eq('branch_id', branchId)

  if (opts.activeOnly) query = query.eq('is_active', true)

  const { data } = await query
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  const doctors = (data as DbHospitalDoctor[] ?? []).map(toHospitalDoctorDTO)

  if (opts.withSchedules && doctors.length) {
    const ids = doctors.map((d) => d.id)
    const [{ data: schedules }, { data: leaves }] = await Promise.all([
      supabase
        .from('hospital_doctor_schedules')
        .select('*')
        .in('doctor_id', ids)
        .order('weekday', { ascending: true })
        .order('session', { ascending: true }),
      supabase
        .from('hospital_doctor_leaves')
        .select('*')
        .in('doctor_id', ids)
        .order('leave_date', { ascending: true }),
    ])

    const schedulesByDoc = new Map<string, DbHospitalDoctorSchedule[]>()
    for (const s of (schedules ?? []) as DbHospitalDoctorSchedule[]) {
      const list = schedulesByDoc.get(s.doctor_id) ?? []
      list.push(s)
      schedulesByDoc.set(s.doctor_id, list)
    }
    const leavesByDoc = new Map<string, DbHospitalDoctorLeave[]>()
    for (const l of (leaves ?? []) as DbHospitalDoctorLeave[]) {
      const list = leavesByDoc.get(l.doctor_id) ?? []
      list.push(l)
      leavesByDoc.set(l.doctor_id, list)
    }

    for (const doc of doctors) {
      doc.schedules = (schedulesByDoc.get(doc.id) ?? []).map(toHospitalDoctorScheduleDTO)
      doc.leaves = (leavesByDoc.get(doc.id) ?? []).map(toHospitalDoctorLeaveDTO)
    }
  }

  return doctors
})

// ── Rooms ─────────────────────────────────────────────────────
export const getHospitalRooms = cache(async (branchId: string): Promise<HospitalRoomDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_rooms')
    .select('*')
    .eq('branch_id', branchId)
    .order('display_order', { ascending: true })
    .order('label', { ascending: true })

  return (data as DbHospitalRoom[] ?? []).map(toHospitalRoomDTO)
})

export const getHospitalRoomByToken = cache(async (token: string): Promise<HospitalRoomDTO | null> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_rooms')
    .select('*')
    .eq('room_token', token)
    .maybeSingle()

  return data ? toHospitalRoomDTO(data as DbHospitalRoom) : null
})

// ── Kiosk bootstrap (branch_token auth, no session) ───────────
export interface HospitalKioskPacket {
  status: 'ok' | 'not-found' | 'inactive'
  branchId?: string
  branchName?: string
  customerId?: string
  departments?: HospitalDepartmentDTO[]
  doctors?: HospitalDoctorDTO[]
  settings?: HospitalSettingsDTO | null
  silentPrint?: boolean
  printerName?: string
  publicTrackingEnabled?: boolean
}

export const getHospitalKioskPacket = cache(async (branchToken: string): Promise<HospitalKioskPacket> => {
  const supabase = createSupabaseServiceClient()
  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, customer_id, is_active, silent_print, printer_name')
    .eq('branch_token', branchToken)
    .maybeSingle()

  if (!branch) return { status: 'not-found' }

  const row = branch as {
    id: string; name: string; customer_id: string
    is_active: boolean; silent_print: boolean; printer_name: string
  }
  if (!row.is_active) return { status: 'inactive' }

  const [departments, doctors, settings, publicTrackingEnabled] = await Promise.all([
    getHospitalDepartments(row.id, { activeOnly: true }),
    getHospitalDoctors(row.id, { activeOnly: true }),
    getHospitalSettings(row.id),
    getHospitalPublicTrackingEnabled(row.customer_id, row.id),
  ])

  return {
    status: 'ok',
    branchId: row.id,
    branchName: row.name,
    customerId: row.customer_id,
    departments,
    doctors,
    settings,
    silentPrint: row.silent_print,
    printerName: row.printer_name,
    publicTrackingEnabled,
  }
})

// ── TV board ──────────────────────────────────────────────────
export const getHospitalBoard = cache(async (screenToken: string): Promise<HospitalBoardPacket> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_hospital_board', { p_screen_token: screenToken })

  if (error || !data) return { status: 'not-found' }
  return data as HospitalBoardPacket
})

// ── Public ticket tracking (public_code auth, no session) ─────
// What the QR on a printed ticket points at. Not cache()'d: the public page
// polls this repeatedly, so per-request memoization buys nothing.
export async function getHospitalTicketStatus(code: string): Promise<HospitalTicketStatus> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_hospital_ticket_status', { p_code: code })

  if (error || !data) return { status: 'not-found' }
  return data as HospitalTicketStatus
}

// The shared /t/[code] tracker + /api/public/ticket/[code] route are
// school-shaped (PublicTicketStatus). Rather than fork a 700-line client, a
// hospital ticket is normalised into the same shape: the room (with the doctor
// appended) stands in for the school's "counter", the department maps straight
// across, and stage is folded into the department line so the patient sees
// where they are in the journey. NO patient PII is in the RPC output.
export async function getHospitalPublicTicketStatus(
  code: string
): Promise<PublicTicketStatus | null> {
  const s = await getHospitalTicketStatus(code)
  if (s.status === 'not-found') return null

  const STAGE_LABEL: Record<string, string> = {
    registration: 'Registration', triage: 'Triage', consult: 'Consultation', lab: 'Lab',
    radiology: 'Radiology', pharmacy: 'Pharmacy', billing: 'Billing', review: 'Review with doctor',
  }
  const deptEn = s.departmentNameEn ?? ''
  const stageEn = s.stage ? STAGE_LABEL[s.stage] ?? s.stage : ''
  const deptLine = stageEn && stageEn.toLowerCase() !== deptEn.toLowerCase()
    ? `${deptEn} · ${stageEn}`
    : deptEn || stageEn
  const roomLine = [s.roomLabel, s.doctorName].filter(Boolean).join(' · ')

  return {
    status: s.status,
    schoolName: s.hospitalNameI18n ?? (s.hospitalName ? { en: s.hospitalName } : undefined),
    schoolNameEn: s.hospitalName,
    logoUrl: s.logoUrl,
    languages: s.languages,
    locale: s.locale ?? null,
    tokenCode: s.tokenCode,
    // SchoolTokenStatus has no 'serving' — the hospital flow never persists it
    // either, but fold it to 'called' defensively for the shared tracker.
    tokenStatus: s.tokenStatus === 'serving' ? 'called' : s.tokenStatus,
    isPriority: !!s.priorityCategory,
    joinedAt: s.joinedAt,
    calledAt: s.calledAt ?? null,
    departmentName: deptLine ? { en: deptLine } : undefined,
    departmentNameEn: deptLine,
    counterName: roomLine ? { en: roomLine } : undefined,
    counterNameEn: roomLine || null,
    serviceDate: s.serviceDate,
    isToday: s.isToday,
    waitingAhead: s.waitingAhead,
    nowServingCode: s.nowServingCode ?? null,
    etaSeconds: s.etaSeconds,
    paceSampleCount: s.paceSampleCount,
  }
}

// ── Tokens ────────────────────────────────────────────────────
export const getTodayHospitalTokens = cache(async (branchId: string): Promise<HospitalTokenDTO[]> => {
  const serviceDate = await getHospitalServiceDate(branchId)
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_tokens')
    .select('*')
    .eq('branch_id', branchId)
    .eq('service_date', serviceDate)
    .order('joined_at', { ascending: true })

  return (data as DbHospitalToken[] ?? []).map(toHospitalTokenDTO)
})

export interface HospitalTokenFilters {
  from?: string
  to?: string
  departmentId?: string
  status?: string
  search?: string
}

export async function getHospitalTokensPage(
  branchId: string,
  filters: HospitalTokenFilters,
  page = 1
): Promise<{ tokens: HospitalTokenDTO[]; total: number }> {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('hospital_tokens')
    .select('*', { count: 'exact' })
    .eq('branch_id', branchId)

  if (filters.from) query = query.gte('service_date', filters.from)
  if (filters.to) query = query.lte('service_date', filters.to)
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.search) {
    // Strip PostgREST filter metacharacters — same guard as the activity log
    // search in lib/dal/queue.ts.
    const term = filters.search.trim().replace(/[,()%*]/g, '')
    if (term) query = query.ilike('token_code', `%${term}%`)
  }

  const offset = (page - 1) * HOSPITAL_TOKEN_PAGE_SIZE
  const { data, count } = await query
    .order('joined_at', { ascending: false })
    .range(offset, offset + HOSPITAL_TOKEN_PAGE_SIZE - 1)

  return {
    tokens: (data as DbHospitalToken[] ?? []).map(toHospitalTokenDTO),
    total: count ?? 0,
  }
}

// ── Token events (the audit trail) ────────────────────────────
export const getHospitalEvents = cache(async (branchId: string, limit = 30): Promise<HospitalTokenEventDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_token_events')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as DbHospitalTokenEvent[] ?? []).map(toHospitalTokenEventDTO)
})

// ── Patients (reception) ─────────────────────────────────────
// Search is by UHID / phone / name prefix. Every hit writes a DPDP access
// log — the caller passes the profile that did the looking.
export async function searchHospitalPatients(
  customerId: string,
  query: string,
  accessedBy: string,
  limit = 20
): Promise<HospitalPatientDTO[]> {
  const supabase = createSupabaseServiceClient()
  const term = query.trim()
  if (!term) return []

  // UHID exact / prefix, phone prefix, or name ilike — one OR group.
  const { data } = await supabase
    .from('hospital_patients')
    .select('*')
    .eq('customer_id', customerId)
    .or(`uhid.ilike.${term}%,phone.ilike.${term}%,name.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(limit)

  const rows = (data as DbHospitalPatient[] ?? [])

  if (rows.length > 0) {
    await supabase.from('hospital_patient_access_logs').insert(
      rows.map((r) => ({
        customer_id: customerId,
        patient_id: r.id,
        accessed_by: accessedBy,
        reason: 'reception-search',
      }))
    )
  }

  return rows.map(toHospitalPatientDTO)
}

// A single patient record with their visit history and every token those
// visits have issued. Writes one DPDP access-log row — this is a detail view.
export interface HospitalPatientDetail {
  patient: HospitalPatientDTO
  visits: HospitalVisitDTO[]
  tokens: HospitalTokenDTO[]
}

export async function getHospitalPatientDetail(
  customerId: string,
  patientId: string,
  accessedBy: string
): Promise<HospitalPatientDetail | null> {
  const supabase = createSupabaseServiceClient()
  const { data: patient } = await supabase
    .from('hospital_patients')
    .select('*')
    .eq('id', patientId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!patient) return null

  const [{ data: visits }, { data: tokens }] = await Promise.all([
    supabase
      .from('hospital_visits')
      .select('*')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .limit(30),
    supabase
      .from('hospital_tokens')
      .select('*, hospital_visits!inner(patient_id)')
      .eq('hospital_visits.patient_id', patientId)
      .order('joined_at', { ascending: false })
      .limit(60),
  ])

  await supabase.from('hospital_patient_access_logs').insert({
    customer_id: customerId,
    patient_id: patientId,
    accessed_by: accessedBy,
    reason: 'reception-detail',
  })

  return {
    patient: toHospitalPatientDTO(patient as DbHospitalPatient),
    visits: ((visits ?? []) as DbHospitalVisit[]).map(toHospitalVisitDTO),
    tokens: ((tokens ?? []) as DbHospitalToken[]).map(toHospitalTokenDTO),
  }
}

// ── Visits ────────────────────────────────────────────────────
export const getPatientVisits = cache(async (
  patientId: string,
  opts: { limit?: number } = {}
): Promise<HospitalVisitDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_visits')
    .select('*')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(opts.limit ?? 20)

  return (data as DbHospitalVisit[] ?? []).map(toHospitalVisitDTO)
})

// ── Dashboard ─────────────────────────────────────────────────
// Wait time is called_at − joined_at, per stage (a transferred token's clock
// restarts — honest, the patient was being served meanwhile). NOT the
// restaurant getDashboardStats completed_at − started_at mislabel.
export async function getHospitalDashboardStats(branchId: string): Promise<HospitalDashboardStats> {
  const [tokens, departments] = await Promise.all([
    getTodayHospitalTokens(branchId),
    getHospitalDepartments(branchId, { activeOnly: true }),
  ])

  const waitMinutes = (t: HospitalTokenDTO): number | null => {
    if (!t.calledAt) return null
    return Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
  }

  const avgOf = (list: HospitalTokenDTO[]): number => {
    const waits = list.map(waitMinutes).filter((m): m is number => m !== null && m >= 0)
    if (waits.length === 0) return 0
    return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
  }

  const byDepartment: HospitalDepartmentStats[] = departments.map((dept) => {
    const list = tokens.filter((t) => t.departmentId === dept.id)
    return {
      departmentId: dept.id,
      name: dept.name,
      color: dept.color,
      type: dept.type,
      total: list.length,
      waiting: list.filter((t) => t.status === 'waiting' || t.status === 'held').length,
      served: list.filter((t) => t.status === 'served').length,
      noShow: list.filter((t) => t.status === 'no-show').length,
      avgWaitMinutes: avgOf(list),
    }
  })

  return {
    totalTokens: tokens.length,
    waiting: tokens.filter((t) => t.status === 'waiting' || t.status === 'held').length,
    called: tokens.filter((t) => t.status === 'called').length,
    served: tokens.filter((t) => t.status === 'served').length,
    noShow: tokens.filter((t) => t.status === 'no-show').length,
    cancelled: tokens.filter((t) => t.status === 'cancelled').length,
    avgWaitMinutes: avgOf(tokens),
    byDepartment,
  }
}

// ── Kiosk feed ────────────────────────────────────────────────
// The rail on the lobby kiosk: the tail of today's tokens, newest first — the
// rail exists to correct the tap that just happened, so the row someone is
// reaching for is the top one. Token codes only — no patient join.
const KIOSK_RECENT_LIMIT = 30

export async function getHospitalKioskFeed(branchToken: string): Promise<HospitalKioskFeed> {
  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, is_active')
    .eq('branch_token', branchToken)
    .maybeSingle()

  if (!branch || !(branch as { is_active: boolean }).is_active) return { status: 'not-found' }
  const branchId = (branch as { id: string }).id

  const { data: serviceDate } = await supabase.rpc('hospital_service_date', { p_branch_id: branchId })

  const [{ data: recent }, { data: waiting }, { count: issuedToday }] = await Promise.all([
    supabase
      .from('hospital_tokens')
      .select('*')
      .eq('branch_id', branchId)
      .eq('service_date', serviceDate as string)
      .order('joined_at', { ascending: false })
      .limit(KIOSK_RECENT_LIMIT),
    // Only the department column: this is a depth count per tile, and pulling
    // whole rows for a queue that can be hundreds long is wasted bandwidth on
    // a 6-second poll.
    supabase
      .from('hospital_tokens')
      .select('department_id')
      .eq('branch_id', branchId)
      .eq('service_date', serviceDate as string)
      .in('status', ['waiting', 'held']),
    supabase
      .from('hospital_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('service_date', serviceDate as string),
  ])

  const waitingRows = (waiting ?? []) as { department_id: string }[]
  const waitingByDepartment: Record<string, number> = {}
  for (const row of waitingRows) {
    waitingByDepartment[row.department_id] = (waitingByDepartment[row.department_id] ?? 0) + 1
  }

  return {
    status: 'ok',
    serviceDate: serviceDate as string,
    recent: ((recent ?? []) as DbHospitalToken[]).map(toHospitalTokenDTO),
    waitingByDepartment,
    waitingTotal: waitingRows.length,
    issuedToday: issuedToday ?? 0,
  }
}

// ── Reports ───────────────────────────────────────────────────
// Wait time here is the honest per-stage figure: called_at − joined_at on the
// token row, where joined_at was reset by each transfer (a transferred token's
// clock restarts because the patient *was* being served in between). This is
// NOT the restaurant completed_at − started_at mislabel the school plan flagged.
export interface HospitalReport {
  from: string
  to: string
  totalTokens: number
  served: number
  noShow: number
  cancelled: number
  avgWaitMinutes: number
  noShowRate: number
  byDay: { date: string; issued: number; served: number }[]
  byDepartment: { id: string; name: string; color: string; total: number; served: number; noShow: number; avgWaitMinutes: number }[]
  byDoctor: { id: string; name: string; served: number; avgWaitMinutes: number }[]
  byHour: { hour: number; count: number }[]
  stageFunnel: { stage: string; reached: number }[]
}

const REPORT_STAGES = ['registration', 'triage', 'consult', 'lab', 'radiology', 'review', 'pharmacy', 'billing']

export async function getHospitalReport(
  branchId: string,
  from: string,
  to: string
): Promise<HospitalReport> {
  const supabase = createSupabaseServiceClient()

  const [{ data: tokenRows }, { data: eventRows }, departments, doctors] = await Promise.all([
    supabase
      .from('hospital_tokens')
      .select('*')
      .eq('branch_id', branchId)
      .gte('service_date', from)
      .lte('service_date', to)
      .limit(20000),
    supabase
      .from('hospital_token_events')
      .select('token_id, to_stage')
      .eq('branch_id', branchId)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .not('to_stage', 'is', null)
      .limit(50000),
    getHospitalDepartments(branchId),
    getHospitalDoctors(branchId),
  ])

  const tokens = ((tokenRows ?? []) as DbHospitalToken[]).map(toHospitalTokenDTO)
  const docById = new Map(doctors.map((d) => [d.id, d]))

  const waitMin = (t: HospitalTokenDTO): number | null => {
    if (!t.calledAt) return null
    const m = Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
    return m >= 0 ? m : null
  }
  const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0)

  const served = tokens.filter((t) => t.status === 'served').length
  const noShow = tokens.filter((t) => t.status === 'no-show').length
  const cancelled = tokens.filter((t) => t.status === 'cancelled').length

  // By day
  const dayMap = new Map<string, { issued: number; served: number }>()
  for (const t of tokens) {
    const d = dayMap.get(t.serviceDate) ?? { issued: 0, served: 0 }
    d.issued++
    if (t.status === 'served') d.served++
    dayMap.set(t.serviceDate, d)
  }
  const byDay = [...dayMap.entries()].sort().map(([date, v]) => ({ date, ...v }))

  // By department
  const byDepartment = departments.map((dept) => {
    const list = tokens.filter((t) => t.departmentId === dept.id)
    return {
      id: dept.id,
      name: pickLocaleName(dept.name),
      color: dept.color,
      total: list.length,
      served: list.filter((t) => t.status === 'served').length,
      noShow: list.filter((t) => t.status === 'no-show').length,
      avgWaitMinutes: avg(list.map(waitMin).filter((m): m is number => m !== null)),
    }
  }).filter((d) => d.total > 0)

  // By doctor
  const doctorIds = [...new Set(tokens.map((t) => t.doctorId).filter((x): x is string => !!x))]
  const byDoctor = doctorIds.map((id) => {
    const list = tokens.filter((t) => t.doctorId === id)
    return {
      id,
      name: docById.get(id)?.name ?? 'Unknown',
      served: list.filter((t) => t.status === 'served').length,
      avgWaitMinutes: avg(list.map(waitMin).filter((m): m is number => m !== null)),
    }
  }).sort((a, b) => b.served - a.served)

  // By hour of issuance
  const hourCounts = new Array(24).fill(0)
  for (const t of tokens) hourCounts[new Date(t.joinedAt).getHours()]++
  const byHour = hourCounts.map((count, hour) => ({ hour, count }))

  // Stage funnel — distinct tokens that ever reached each stage (from events).
  const reachedByStage = new Map<string, Set<string>>()
  for (const e of (eventRows ?? []) as { token_id: string | null; to_stage: string | null }[]) {
    if (!e.token_id || !e.to_stage) continue
    const set = reachedByStage.get(e.to_stage) ?? new Set<string>()
    set.add(e.token_id)
    reachedByStage.set(e.to_stage, set)
  }
  const stageFunnel = REPORT_STAGES
    .map((stage) => ({ stage, reached: reachedByStage.get(stage)?.size ?? 0 }))
    .filter((s) => s.reached > 0)

  return {
    from,
    to,
    totalTokens: tokens.length,
    served,
    noShow,
    cancelled,
    avgWaitMinutes: avg(tokens.map(waitMin).filter((m): m is number => m !== null)),
    noShowRate: tokens.length ? Math.round((noShow / tokens.length) * 100) : 0,
    byDay,
    byDepartment,
    byDoctor,
    byHour,
    stageFunnel,
  }
}

function pickLocaleName(name: { en: string } & Record<string, string | undefined>): string {
  return name.en ?? Object.values(name)[0] ?? ''
}
