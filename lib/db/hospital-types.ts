// Hospital queue system — row types, DTOs and mappers.
//
// Kept in its own file rather than appended to lib/db/types.ts: the hospital
// product is a separate namespace with its own tables, and the shared file is
// already the single largest source of merge friction (same decision the
// school vertical made). Shared primitives are re-exported, never redefined.

import type { AnnouncementLang } from '@/lib/db/types'
import type { Locale, LocaleMap } from '@/lib/region'

// ── Primitive types ───────────────────────────────────────────
export type HospitalTokenStatus =
  | 'waiting' | 'called' | 'serving' | 'held' | 'served' | 'no-show' | 'cancelled'

export type HospitalTokenSource = 'kiosk' | 'reception' | 'appointment' | 'whatsapp' | 'api'

// Which leg of the patient journey a token is currently queuing for.
export type HospitalStage =
  | 'registration' | 'triage' | 'consult' | 'lab' | 'radiology' | 'pharmacy' | 'billing' | 'review'

export type HospitalDepartmentType =
  | 'opd' | 'lab' | 'radiology' | 'pharmacy' | 'billing' | 'triage'

// Social priority — expected at an Indian OPD, so a visible kiosk toggle, not
// a hidden admin flag. NULL/absent = normal lane.
export type HospitalPriorityCategory = 'senior' | 'emergency' | 'pregnant' | 'differently-abled'

export type HospitalVisitType = 'new' | 'followup'
export type HospitalGender = 'male' | 'female' | 'other'

export type HospitalActor = 'kiosk' | 'reception' | 'room' | 'system'

export type HospitalLanguage = Locale

// How much of a branch's provider-assigned department/room allowance is spent.
// Lives here rather than in lib/dal/hospital-limits.ts because the manager UIs
// are client components and that module is server-only (school pattern).
export interface HospitalQuota {
  limit: number
  used: number
  remaining: number
}

// ── DB Row Types (snake_case — exact DB columns) ──────────────
export interface DbHospitalSettings {
  id: string
  customer_id: string
  branch_id: string
  hospital_name: LocaleMap
  logo_url: string
  languages: HospitalLanguage[]
  ticket_footer: LocaleMap
  kiosk_idle_seconds: number
  priority_enabled: boolean
  announce_enabled: boolean
  announce_template: LocaleMap
  print_enabled: boolean
  appt_walkin_ratio: number
  followup_free_days: number
  priority_grace_minutes: number
  patient_data_retention_days: number | null
  public_tracking_enabled: boolean
  timezone: string
  day_start_time: string
  created_at: string
  updated_at: string
}

export interface DbHospitalDepartment {
  id: string
  customer_id: string
  branch_id: string
  name: LocaleMap
  prefix: string
  type: HospitalDepartmentType
  number_start: number
  color: string
  icon: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbHospitalDoctor {
  id: string
  customer_id: string
  branch_id: string
  department_id: string
  name: string
  specialization: string
  fee_paise: number
  avg_consult_minutes: number
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbHospitalDoctorSchedule {
  id: string
  customer_id: string
  doctor_id: string
  weekday: number
  session: 'am' | 'pm'
  start_time: string
  end_time: string
  slot_minutes: number
  max_tokens: number
  created_at: string
}

export interface DbHospitalDoctorLeave {
  id: string
  customer_id: string
  doctor_id: string
  leave_date: string
  reason: string
  created_at: string
}

export interface DbHospitalRoom {
  id: string
  customer_id: string
  branch_id: string
  department_id: string
  label: string
  room_token: string
  current_doctor_id: string | null
  display_order: number
  is_open: boolean
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface DbHospitalPatient {
  id: string
  customer_id: string
  uhid: string
  name: string
  phone: string
  dob: string | null
  gender: HospitalGender | null
  abha_number: string | null
  consent_at: string
  created_at: string
  updated_at: string
}

export interface DbHospitalVisit {
  id: string
  customer_id: string
  branch_id: string
  patient_id: string
  visit_date: string
  type: HospitalVisitType
  status: 'active' | 'completed'
  created_at: string
  updated_at: string
}

export interface DbHospitalToken {
  id: string
  customer_id: string
  branch_id: string
  visit_id: string | null
  department_id: string
  doctor_id: string | null
  room_id: string | null
  service_date: string
  number: number
  token_code: string
  stage: HospitalStage
  status: HospitalTokenStatus
  priority_category: HospitalPriorityCategory | null
  source: HospitalTokenSource
  appointment_id: string | null
  public_code: string
  locale: string | null
  notes: string
  joined_at: string
  called_at: string | null
  served_at: string | null
  call_count: number
  recall_count: number
  created_at: string
}

export interface DbHospitalVitals {
  id: string
  customer_id: string
  token_id: string
  bp_systolic: number | null
  bp_diastolic: number | null
  spo2: number | null
  temp_c: number | null
  weight_kg: number | null
  notes: string
  recorded_by: string | null
  created_at: string
}

export interface DbHospitalTokenEvent {
  id: string
  customer_id: string
  branch_id: string
  token_id: string | null
  room_id: string | null
  department_id: string | null
  doctor_id: string | null
  performed_by: string | null
  actor: HospitalActor
  from_status: string | null
  to_status: string
  from_stage: string | null
  to_stage: string | null
  token_code: string
  message: string
  created_at: string
}

// ── DTO Types (camelCase — what crosses to the client) ─────────
export interface HospitalSettingsDTO {
  id: string
  customerId: string
  branchId: string
  hospitalName: LocaleMap
  logoUrl: string
  languages: HospitalLanguage[]
  ticketFooter: LocaleMap
  kioskIdleSeconds: number
  priorityEnabled: boolean
  announceEnabled: boolean
  announceTemplate: LocaleMap
  printEnabled: boolean
  apptWalkinRatio: number
  followupFreeDays: number
  priorityGraceMinutes: number
  patientDataRetentionDays: number | null
  publicTrackingEnabled: boolean
  timezone: string
  dayStartTime: string
}

export interface HospitalDepartmentDTO {
  id: string
  customerId: string
  branchId: string
  name: LocaleMap
  prefix: string
  type: HospitalDepartmentType
  numberStart: number
  color: string
  icon: string
  displayOrder: number
  isActive: boolean
  createdAt: string
}

export interface HospitalDoctorDTO {
  id: string
  customerId: string
  branchId: string
  departmentId: string
  name: string
  specialization: string
  feePaise: number
  avgConsultMinutes: number
  displayOrder: number
  isActive: boolean
  createdAt: string
  // Joined when the caller asks: this doctor's weekly schedule and leaves.
  schedules?: HospitalDoctorScheduleDTO[]
  leaves?: HospitalDoctorLeaveDTO[]
}

export interface HospitalDoctorScheduleDTO {
  id: string
  doctorId: string
  weekday: number
  session: 'am' | 'pm'
  startTime: string
  endTime: string
  slotMinutes: number
  maxTokens: number
}

export interface HospitalDoctorLeaveDTO {
  id: string
  doctorId: string
  leaveDate: string
  reason: string
}

export interface HospitalRoomDTO {
  id: string
  customerId: string
  branchId: string
  departmentId: string
  label: string
  token: string
  currentDoctorId: string | null
  displayOrder: number
  isOpen: boolean
  isActive: boolean
  lastSeenAt: string | null
  createdAt: string
}

export interface HospitalPatientDTO {
  id: string
  customerId: string
  uhid: string
  name: string
  phone: string
  dob: string | null
  gender: HospitalGender | null
  abhaNumber: string | null
  consentAt: string
  createdAt: string
}

export interface HospitalVisitDTO {
  id: string
  customerId: string
  branchId: string
  patientId: string
  visitDate: string
  type: HospitalVisitType
  status: 'active' | 'completed'
  createdAt: string
}

export interface HospitalTokenDTO {
  id: string
  customerId: string
  branchId: string
  visitId: string | null
  departmentId: string
  doctorId: string | null
  roomId: string | null
  serviceDate: string
  number: number
  tokenCode: string
  stage: HospitalStage
  status: HospitalTokenStatus
  priorityCategory: HospitalPriorityCategory | null
  source: HospitalTokenSource
  appointmentId: string | null
  publicCode: string
  locale: string | null
  notes: string
  joinedAt: string
  calledAt: string | null
  servedAt: string | null
  callCount: number
  recallCount: number
  createdAt: string
}

export interface HospitalVitalsDTO {
  id: string
  tokenId: string
  bpSystolic: number | null
  bpDiastolic: number | null
  spo2: number | null
  tempC: number | null
  weightKg: number | null
  notes: string
  createdAt: string
}

export interface HospitalTokenEventDTO {
  id: string
  customerId: string
  branchId: string
  tokenId: string | null
  roomId: string | null
  departmentId: string | null
  doctorId: string | null
  performedBy: string | null
  actor: HospitalActor
  fromStatus: string | null
  toStatus: string
  fromStage: string | null
  toStage: string | null
  tokenCode: string
  message: string
  createdAt: string
}

// ── Board packet (from the get_hospital_board RPC) ─────────────
// One row per open room — the OPD's TOKEN | ROOM | DOCTOR layout. A room with
// no current token still appears, showing nothing. Token codes and room /
// doctor labels only — the RPC never joins hospital_patients.
export interface HospitalBoardRoom {
  id: string
  label: string
  display_order: number
  is_open: boolean
  last_seen_at: string | null
  department_id: string | null
  department_en: string | null
  department_name: LocaleMap | null
  department_type: HospitalDepartmentType | null
  department_color: string | null
  doctor_name: string | null
  doctor_missing: boolean | null
  doctor_on_leave: boolean | null
  token_id: string | null
  token_code: string | null
  called_at: string | null
  recall_count: number | null
  priority_category: HospitalPriorityCategory | null
  stage: HospitalStage | null
}

export interface HospitalBoardRecent {
  token_code: string
  served_at: string
  room_label: string | null
}

export interface HospitalBoardDepartment {
  id: string
  name_en: string
  name: LocaleMap | null
  color: string
  type: HospitalDepartmentType
  display_order: number
  waiting: number
}

export interface HospitalBoardPacket {
  status: 'ok' | 'expired' | 'not-found'
  screenId?: string
  branchId?: string
  customerId?: string
  serviceDate?: string
  hospitalName?: string
  hospitalNameI18n?: LocaleMap
  logoUrl?: string
  primaryColor?: string
  announcementLang?: AnnouncementLang
  announceLocales?: Locale[]
  announceEnabled?: boolean
  announceTemplateI18n?: LocaleMap
  showClock?: boolean
  tickerText?: string
  rooms?: HospitalBoardRoom[]
  recent?: HospitalBoardRecent[]
  departments?: HospitalBoardDepartment[]
  ads?: {
    id: string
    file_url: string
    file_type: 'image' | 'video'
    duration_seconds: number
    is_active: boolean
    audio_enabled?: boolean
    // Missing on rows written before the placement column existed —
    // HospitalBoard treats that the same as 'side'.
    placement?: 'side' | 'fullscreen'
  }[]
  tickers?: { id: string; message: string }[]
}

// What the lobby kiosk polls: queue depth per department tile, the recent
// rail, and today's count. Names only — no patient data crosses here either.
export interface HospitalKioskFeed {
  status: 'ok' | 'not-found'
  serviceDate?: string
  recent?: HospitalTokenDTO[]
  waitingByDepartment?: Record<string, number>
  waitingTotal?: number
  issuedToday?: number
}

// ── Dashboard ─────────────────────────────────────────────────
export interface HospitalDepartmentStats {
  departmentId: string
  name: LocaleMap
  color: string
  type: HospitalDepartmentType
  total: number
  waiting: number
  served: number
  noShow: number
  avgWaitMinutes: number
}

export interface HospitalDashboardStats {
  totalTokens: number
  waiting: number
  called: number
  served: number
  noShow: number
  cancelled: number
  // Actual wait: called_at − joined_at (per stage — a transferred token's
  // clock restarts, which is honest: the patient was being served meanwhile).
  avgWaitMinutes: number
  byDepartment: HospitalDepartmentStats[]
}

// ── Public ticket status (from get_hospital_ticket_status RPC) ─
// camelCase JSON directly from json_build_object — consumed as-is, no mapper.
export interface HospitalTicketStatus {
  status: 'ok' | 'not-found' | 'disabled' | 'expired'
  hospitalName?: string
  hospitalNameI18n?: LocaleMap
  logoUrl?: string
  languages?: HospitalLanguage[]
  locale?: HospitalLanguage | null
  tokenCode?: string
  tokenStatus?: HospitalTokenStatus
  stage?: HospitalStage
  priorityCategory?: HospitalPriorityCategory | null
  joinedAt?: string
  calledAt?: string | null
  departmentName?: LocaleMap
  departmentNameEn?: string
  departmentType?: HospitalDepartmentType
  roomLabel?: string | null
  doctorName?: string | null
  serviceDate?: string
  isToday?: boolean
  waitingAhead?: number
  nowServingCode?: string | null
  etaSeconds?: number
  paceSampleCount?: number
}

// ── Mapper Functions ───────────────────────────────────────────

// Normalise a jsonb locale map from the DB: tolerate `{}` / null / a missing
// 'en' key by falling the base locale back to the paired legacy column.
export function toLocaleMap(raw: unknown, fallbackEn = ''): LocaleMap {
  const m = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, string>) }
    : {}
  if (!m.en) m.en = fallbackEn
  return m as LocaleMap
}

export function toHospitalSettingsDTO(row: DbHospitalSettings): HospitalSettingsDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    hospitalName: toLocaleMap(row.hospital_name),
    logoUrl: row.logo_url,
    languages: row.languages ?? ['en'],
    ticketFooter: toLocaleMap(row.ticket_footer),
    kioskIdleSeconds: row.kiosk_idle_seconds,
    priorityEnabled: row.priority_enabled,
    announceEnabled: row.announce_enabled,
    announceTemplate: toLocaleMap(row.announce_template),
    printEnabled: row.print_enabled,
    apptWalkinRatio: row.appt_walkin_ratio,
    followupFreeDays: row.followup_free_days,
    priorityGraceMinutes: row.priority_grace_minutes,
    patientDataRetentionDays: row.patient_data_retention_days,
    publicTrackingEnabled: row.public_tracking_enabled,
    timezone: row.timezone,
    dayStartTime: row.day_start_time,
  }
}

export function toHospitalDepartmentDTO(row: DbHospitalDepartment): HospitalDepartmentDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    name: toLocaleMap(row.name),
    prefix: row.prefix,
    type: row.type,
    numberStart: row.number_start,
    color: row.color,
    icon: row.icon,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function toHospitalDoctorDTO(row: DbHospitalDoctor): HospitalDoctorDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    departmentId: row.department_id,
    name: row.name,
    specialization: row.specialization,
    feePaise: row.fee_paise,
    avgConsultMinutes: row.avg_consult_minutes,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function toHospitalDoctorScheduleDTO(row: DbHospitalDoctorSchedule): HospitalDoctorScheduleDTO {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    weekday: row.weekday,
    session: row.session,
    startTime: row.start_time,
    endTime: row.end_time,
    slotMinutes: row.slot_minutes,
    maxTokens: row.max_tokens,
  }
}

export function toHospitalDoctorLeaveDTO(row: DbHospitalDoctorLeave): HospitalDoctorLeaveDTO {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    leaveDate: row.leave_date,
    reason: row.reason,
  }
}

export function toHospitalRoomDTO(row: DbHospitalRoom): HospitalRoomDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    departmentId: row.department_id,
    label: row.label,
    token: row.room_token,
    currentDoctorId: row.current_doctor_id,
    displayOrder: row.display_order,
    isOpen: row.is_open,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }
}

export function toHospitalPatientDTO(row: DbHospitalPatient): HospitalPatientDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    uhid: row.uhid,
    name: row.name,
    phone: row.phone,
    dob: row.dob,
    gender: row.gender,
    abhaNumber: row.abha_number,
    consentAt: row.consent_at,
    createdAt: row.created_at,
  }
}

export function toHospitalVisitDTO(row: DbHospitalVisit): HospitalVisitDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    patientId: row.patient_id,
    visitDate: row.visit_date,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function toHospitalTokenDTO(row: DbHospitalToken): HospitalTokenDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    visitId: row.visit_id,
    departmentId: row.department_id,
    doctorId: row.doctor_id,
    roomId: row.room_id,
    serviceDate: row.service_date,
    number: row.number,
    tokenCode: row.token_code,
    stage: row.stage,
    status: row.status,
    priorityCategory: row.priority_category,
    source: row.source,
    appointmentId: row.appointment_id,
    publicCode: row.public_code,
    locale: row.locale,
    notes: row.notes,
    joinedAt: row.joined_at,
    calledAt: row.called_at,
    servedAt: row.served_at,
    callCount: row.call_count,
    recallCount: row.recall_count,
    createdAt: row.created_at,
  }
}

export function toHospitalVitalsDTO(row: DbHospitalVitals): HospitalVitalsDTO {
  return {
    id: row.id,
    tokenId: row.token_id,
    bpSystolic: row.bp_systolic,
    bpDiastolic: row.bp_diastolic,
    spo2: row.spo2,
    tempC: row.temp_c,
    weightKg: row.weight_kg,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export function toHospitalTokenEventDTO(row: DbHospitalTokenEvent): HospitalTokenEventDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    tokenId: row.token_id,
    roomId: row.room_id,
    departmentId: row.department_id,
    doctorId: row.doctor_id,
    performedBy: row.performed_by,
    actor: row.actor,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    tokenCode: row.token_code,
    message: row.message,
    createdAt: row.created_at,
  }
}
