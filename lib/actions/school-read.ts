'use server'

import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toSchoolTokenDTO,
  type SchoolTokenDTO, type SchoolBoardPacket, type DbSchoolToken,
} from '@/lib/db/school-types'
import { getSchoolKioskFeed } from '@/lib/dal/school'
import type { SchoolKioskFeed } from '@/lib/db/school-types'

// Client-callable reads for the device surfaces.
//
// These exist because the school tables are service-role-only (see the RLS
// note in the migration): a device page can't query them with the publishable
// key, and shouldn't be able to. Broadcast delivers the instant call events;
// these actions are the state of record, polled on a short interval that also
// recovers a screen whose socket dropped.

export async function fetchSchoolBoardAction(screenToken: string): Promise<SchoolBoardPacket> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_school_board', { p_screen_token: screenToken })
  if (error || !data) return { status: 'not-found' }
  return data as SchoolBoardPacket
}

export interface SchoolCounterView {
  status: 'ok' | 'not-found'
  counterName?: string
  counterNameAr?: string
  isOpen?: boolean
  acceptsPriority?: boolean
  serviceDate?: string
  current?: SchoolTokenDTO | null
  waiting?: SchoolTokenDTO[]
  // Called, nobody came. Kept out of `waiting` so the lane stays a true queue,
  // but surfaced separately: a visitor who missed their call and came back is
  // routine, and without this the console shows no trace of them at all.
  noShows?: SchoolTokenDTO[]
  departments?: { id: string; nameEn: string; nameAr: string; prefix: string; color: string }[]
  // Every active department of the branch — what staff may issue a walk-in
  // token against. Wider than `departments` (which is only what this window
  // serves) because Reception issuing a Fees token is a normal school flow.
  issuable?: { id: string; nameEn: string; nameAr: string; prefix: string; color: string }[]
  servedToday?: number
}

export async function fetchSchoolCounterViewAction(counterToken: string): Promise<SchoolCounterView> {
  const supabase = createSupabaseServiceClient()

  const { data: counter } = await supabase
    .from('school_counters')
    .select('id, branch_id, name_en, name_ar, is_open, is_active, accepts_priority')
    .eq('counter_token', counterToken)
    .maybeSingle()

  if (!counter || !(counter as { is_active: boolean }).is_active) return { status: 'not-found' }

  const c = counter as {
    id: string; branch_id: string; name_en: string; name_ar: string
    is_open: boolean; accepts_priority: boolean
  }

  const { data: serviceDate } = await supabase.rpc('school_service_date', { p_branch_id: c.branch_id })

  const { data: links } = await supabase
    .from('school_counter_departments')
    .select('department_id, preference')
    .eq('counter_id', c.id)
    .order('preference', { ascending: true })

  const departmentIds = ((links ?? []) as { department_id: string }[]).map((l) => l.department_id)

  const [
    { data: departments }, { data: allDepartments }, { data: current },
    { data: waiting }, { data: noShows }, { count: servedToday },
  ] = await Promise.all([
      departmentIds.length
        ? supabase
            .from('school_departments')
            .select('id, name_en, name_ar, prefix, color')
            .in('id', departmentIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('school_departments')
        .select('id, name_en, name_ar, prefix, color')
        .eq('branch_id', c.branch_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('school_tokens')
        .select('*')
        .eq('counter_id', c.id)
        .eq('status', 'called')
        .maybeSingle(),
      departmentIds.length
        ? supabase
            .from('school_tokens')
            .select('*')
            .eq('branch_id', c.branch_id)
            .eq('service_date', serviceDate as string)
            .in('department_id', departmentIds)
            .in('status', ['waiting', 'held'])
            .order('joined_at', { ascending: true })
            .limit(40)
        : Promise.resolve({ data: [] }),
      departmentIds.length
        ? supabase
            .from('school_tokens')
            .select('*')
            .eq('branch_id', c.branch_id)
            .eq('service_date', serviceDate as string)
            .in('department_id', departmentIds)
            .eq('status', 'no-show')
            .order('called_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from('school_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('counter_id', c.id)
        .eq('service_date', serviceDate as string)
        .eq('status', 'served'),
    ])

  // Preserve the manager's preference order so the lane reads the way the
  // NEXT button will actually behave.
  const order = new Map(departmentIds.map((id, i) => [id, i]))
  const deptRows = (departments ?? []) as
    { id: string; name_en: string; name_ar: string; prefix: string; color: string }[]

  return {
    status: 'ok',
    counterName: c.name_en,
    counterNameAr: c.name_ar,
    isOpen: c.is_open,
    acceptsPriority: c.accepts_priority,
    serviceDate: serviceDate as string,
    current: current ? toSchoolTokenDTO(current as DbSchoolToken) : null,
    waiting: ((waiting ?? []) as DbSchoolToken[]).map(toSchoolTokenDTO),
    noShows: ((noShows ?? []) as DbSchoolToken[]).map(toSchoolTokenDTO),
    departments: deptRows
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((d) => ({ id: d.id, nameEn: d.name_en, nameAr: d.name_ar, prefix: d.prefix, color: d.color })),
    issuable: ((allDepartments ?? []) as
      { id: string; name_en: string; name_ar: string; prefix: string; color: string }[])
      .map((d) => ({ id: d.id, nameEn: d.name_en, nameAr: d.name_ar, prefix: d.prefix, color: d.color })),
    servedToday: servedToday ?? 0,
  }
}

// ── Kiosk: today's tokens ─────────────────────────────────────
// Thin wrapper so the kiosk can re-poll what its page was server-rendered
// with. The query itself lives in the DAL, where the page reads it too.
export async function fetchSchoolKioskFeedAction(branchToken: string): Promise<SchoolKioskFeed> {
  return getSchoolKioskFeed(branchToken)
}
