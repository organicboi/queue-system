'use server'

import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toHospitalTokenDTO, toHospitalVitalsDTO,
  type HospitalTokenDTO, type HospitalVitalsDTO, type HospitalBoardPacket,
  type HospitalDepartmentType, type HospitalKioskFeed,
  type DbHospitalToken, type DbHospitalVitals,
} from '@/lib/db/hospital-types'
import { getHospitalKioskFeed } from '@/lib/dal/hospital'

// Client-callable reads for the device surfaces. The hospital tables are
// service-role-only, so a device page can't query them with the publishable
// key. Broadcast delivers instant call events; these are the state of record,
// polled on a short interval that also recovers a screen whose socket dropped.

export async function fetchHospitalBoardAction(screenToken: string): Promise<HospitalBoardPacket> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_hospital_board', { p_screen_token: screenToken })
  if (error || !data) return { status: 'not-found' }
  return data as HospitalBoardPacket
}

export async function fetchHospitalKioskFeedAction(branchToken: string): Promise<HospitalKioskFeed> {
  return getHospitalKioskFeed(branchToken)
}

// ── Room console view ────────────────────────────────────────
export interface HospitalRoomView {
  status: 'ok' | 'not-found'
  roomId?: string
  roomLabel?: string
  isOpen?: boolean
  mode?: 'doctor' | 'service'
  departmentType?: HospitalDepartmentType
  departmentEn?: string
  doctorName?: string | null
  doctorMissing?: boolean
  serviceDate?: string
  current?: HospitalTokenDTO | null
  currentVitals?: HospitalVitalsDTO | null
  waiting?: HospitalTokenDTO[]
  noShows?: HospitalTokenDTO[]
  // Where the doctor console's SEND TO can route: active non-OPD departments.
  sendTargets?: { id: string; name: string; type: HospitalDepartmentType }[]
  // Triage rooms only: the OPD queues a registered/triaged patient can be sent
  // into, each with the doctors on duty today.
  consultTargets?: { departmentId: string; departmentName: string; doctors: { id: string; name: string }[] }[]
  servedToday?: number
}

export async function fetchHospitalRoomViewAction(roomToken: string): Promise<HospitalRoomView> {
  const supabase = createSupabaseServiceClient()

  const { data: room } = await supabase
    .from('hospital_rooms')
    .select('id, branch_id, department_id, label, current_doctor_id, is_open, is_active')
    .eq('room_token', roomToken)
    .maybeSingle()

  if (!room || !(room as { is_active: boolean }).is_active) return { status: 'not-found' }
  const r = room as {
    id: string; branch_id: string; department_id: string; label: string
    current_doctor_id: string | null; is_open: boolean
  }

  const { data: dept } = await supabase
    .from('hospital_departments')
    .select('type, name')
    .eq('id', r.department_id)
    .maybeSingle()
  const departmentType = ((dept as { type?: HospitalDepartmentType } | null)?.type ?? 'opd') as HospitalDepartmentType
  const departmentEn = (dept as { name?: Record<string, string> } | null)?.name?.en ?? ''
  const mode: 'doctor' | 'service' = departmentType === 'opd' ? 'doctor' : 'service'

  const { data: serviceDate } = await supabase.rpc('hospital_service_date', { p_branch_id: r.branch_id })
  const date = serviceDate as string

  let doctorNameVal: string | null = null
  if (r.current_doctor_id) {
    const { data: doc } = await supabase
      .from('hospital_doctors').select('name').eq('id', r.current_doctor_id).maybeSingle()
    doctorNameVal = (doc as { name: string } | null)?.name ?? null
  }

  // The waiting lane: the doctor's queue for an OPD room, the department's pool
  // for a service point. Ordering matches call_next_hospital_token loosely
  // (joined_at, review boost) — enough for the console to read right.
  const laneQuery = supabase
    .from('hospital_tokens')
    .select('*')
    .eq('branch_id', r.branch_id)
    .eq('service_date', date)
    .in('status', ['waiting', 'held'])
    .order('joined_at', { ascending: true })
    .limit(60)

  const [
    { data: current }, { data: waiting }, { data: noShows }, { count: servedToday }, { data: targets },
  ] = await Promise.all([
    supabase
      .from('hospital_tokens')
      .select('*')
      .eq('room_id', r.id)
      .eq('status', 'called')
      .maybeSingle(),
    mode === 'doctor' && r.current_doctor_id
      ? laneQuery.eq('doctor_id', r.current_doctor_id)
      : laneQuery.eq('department_id', r.department_id),
    supabase
      .from('hospital_tokens')
      .select('*')
      .eq('branch_id', r.branch_id)
      .eq('service_date', date)
      .eq('status', 'no-show')
      .eq(mode === 'doctor' && r.current_doctor_id ? 'doctor_id' : 'department_id',
        mode === 'doctor' && r.current_doctor_id ? r.current_doctor_id : r.department_id)
      .order('called_at', { ascending: false })
      .limit(15),
    supabase
      .from('hospital_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', r.id)
      .eq('service_date', date)
      .eq('status', 'served'),
    supabase
      .from('hospital_departments')
      .select('id, name, type')
      .eq('branch_id', r.branch_id)
      .eq('is_active', true)
      .neq('type', 'opd')
      .order('display_order', { ascending: true }),
  ])

  const currentRow = (current as DbHospitalToken | null) ?? null
  let currentVitals: HospitalVitalsDTO | null = null
  if (currentRow) {
    const { data: v } = await supabase
      .from('hospital_vitals').select('*').eq('token_id', currentRow.id).maybeSingle()
    currentVitals = v ? toHospitalVitalsDTO(v as DbHospitalVitals) : null
  }

  // Triage room: build the OPD routing menu with today's on-duty doctors
  // (schedule − leave, resolved here so the console doesn't derive a weekday).
  let consultTargets: HospitalRoomView['consultTargets']
  if (departmentType === 'triage') {
    const weekday = new Date(`${date}T00:00:00`).getDay()
    const [{ data: opdDepts }, { data: opdDoctors }, { data: leaves }] = await Promise.all([
      supabase
        .from('hospital_departments')
        .select('id, name')
        .eq('branch_id', r.branch_id).eq('is_active', true).eq('type', 'opd')
        .order('display_order', { ascending: true }),
      supabase
        .from('hospital_doctors')
        .select('id, name, department_id, hospital_doctor_schedules!inner(weekday)')
        .eq('branch_id', r.branch_id).eq('is_active', true)
        .eq('hospital_doctor_schedules.weekday', weekday),
      supabase
        .from('hospital_doctor_leaves')
        .select('doctor_id')
        .eq('leave_date', date),
    ])
    const onLeave = new Set(((leaves ?? []) as { doctor_id: string }[]).map((l) => l.doctor_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = ((opdDoctors ?? []) as any[]).filter((d) => !onLeave.has(d.id))
    consultTargets = ((opdDepts ?? []) as { id: string; name: Record<string, string> }[])
      .map((dep) => ({
        departmentId: dep.id,
        departmentName: dep.name?.en ?? '',
        doctors: docs.filter((d) => d.department_id === dep.id).map((d) => ({ id: d.id, name: d.name })),
      }))
      .filter((t) => t.doctors.length > 0)
  }

  return {
    status: 'ok',
    roomId: r.id,
    roomLabel: r.label,
    isOpen: r.is_open,
    mode,
    departmentType,
    departmentEn,
    doctorName: doctorNameVal,
    doctorMissing: mode === 'doctor' && !r.current_doctor_id,
    serviceDate: date,
    current: currentRow ? toHospitalTokenDTO(currentRow) : null,
    currentVitals,
    waiting: ((waiting ?? []) as DbHospitalToken[]).map(toHospitalTokenDTO),
    noShows: ((noShows ?? []) as DbHospitalToken[]).map(toHospitalTokenDTO),
    sendTargets: ((targets ?? []) as { id: string; name: Record<string, string>; type: HospitalDepartmentType }[])
      .map((t) => ({ id: t.id, name: t.name?.en ?? '', type: t.type })),
    consultTargets,
    servedToday: servedToday ?? 0,
  }
}
