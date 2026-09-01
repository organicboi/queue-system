import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toSchoolSettingsDTO, toSchoolDepartmentDTO, toSchoolCounterDTO,
  toSchoolTokenDTO, toSchoolActivityLogDTO,
  type SchoolSettingsDTO, type SchoolDepartmentDTO, type SchoolCounterDTO,
  type SchoolTokenDTO, type SchoolActivityLogDTO, type SchoolBoardPacket,
  type SchoolDashboardStats, type SchoolDepartmentStats, type SchoolKioskFeed,
  type DbSchoolSettings, type DbSchoolDepartment, type DbSchoolCounter,
  type DbSchoolToken, type DbSchoolActivityLog, type SchoolBranchIdentity,
} from '@/lib/db/school-types'
import { SCHOOL_TOKEN_PAGE_SIZE } from '@/lib/school/constants'

// Reads use the service-role client and rely on the requireX() guards in
// lib/dal/session.ts — RLS in this schema is self-referentially broken, so the
// school tables follow the same rule as `counters` (service-role-only policy).

// ── Service date ──────────────────────────────────────────────
// Always ask Postgres. Deriving "today" in JS is what makes the existing
// dashboard disagree with the data before 03:00 Qatar time.
export const getSchoolServiceDate = cache(async (branchId: string): Promise<string> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.rpc('school_service_date', { p_branch_id: branchId })
  return (data as string | null) ?? new Date().toISOString().slice(0, 10)
})

// ── Settings ──────────────────────────────────────────────────
export const getSchoolSettings = cache(async (branchId: string): Promise<SchoolSettingsDTO | null> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('school_settings')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle()

  return data ? toSchoolSettingsDTO(data as DbSchoolSettings) : null
})

// ── Departments ───────────────────────────────────────────────
export const getSchoolDepartments = cache(async (
  branchId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<SchoolDepartmentDTO[]> => {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('school_departments')
    .select('*')
    .eq('branch_id', branchId)

  if (opts.activeOnly) query = query.eq('is_active', true)

  const { data } = await query
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (data as DbSchoolDepartment[] ?? []).map(toSchoolDepartmentDTO)
})

// ── Counters ──────────────────────────────────────────────────
export const getSchoolCounters = cache(async (branchId: string): Promise<SchoolCounterDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const [{ data: counters }, { data: links }] = await Promise.all([
    supabase
      .from('school_counters')
      .select('*')
      .eq('branch_id', branchId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('school_counter_departments')
      .select('counter_id, department_id, preference')
      .order('preference', { ascending: true }),
  ])

  const byCounter = new Map<string, string[]>()
  for (const link of (links ?? []) as { counter_id: string; department_id: string }[]) {
    const list = byCounter.get(link.counter_id) ?? []
    list.push(link.department_id)
    byCounter.set(link.counter_id, list)
  }

  return (counters as DbSchoolCounter[] ?? []).map((row) => ({
    ...toSchoolCounterDTO(row),
    departmentIds: byCounter.get(row.id) ?? [],
  }))
})

export const getSchoolCounterByToken = cache(async (token: string): Promise<SchoolCounterDTO | null> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('school_counters')
    .select('*')
    .eq('counter_token', token)
    .maybeSingle()

  if (!data) return null

  const { data: links } = await supabase
    .from('school_counter_departments')
    .select('department_id')
    .eq('counter_id', (data as DbSchoolCounter).id)
    .order('preference', { ascending: true })

  return {
    ...toSchoolCounterDTO(data as DbSchoolCounter),
    departmentIds: ((links ?? []) as { department_id: string }[]).map((l) => l.department_id),
  }
})

// ── Kiosk bootstrap (branch_token auth, no session) ───────────
export interface SchoolKioskPacket {
  status: 'ok' | 'not-found' | 'inactive'
  branchId?: string
  branchName?: string
  customerId?: string
  departments?: SchoolDepartmentDTO[]
  settings?: SchoolSettingsDTO | null
  silentPrint?: boolean
  printerName?: string
}

export const getSchoolKioskPacket = cache(async (branchToken: string): Promise<SchoolKioskPacket> => {
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

  const [departments, settings] = await Promise.all([
    getSchoolDepartments(row.id, { activeOnly: true }),
    getSchoolSettings(row.id),
  ])

  return {
    status: 'ok',
    branchId: row.id,
    branchName: row.name,
    customerId: row.customer_id,
    departments,
    settings,
    silentPrint: row.silent_print,
    printerName: row.printer_name,
  }
})

// ── TV board ──────────────────────────────────────────────────
export const getSchoolBoard = cache(async (screenToken: string): Promise<SchoolBoardPacket> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_school_board', { p_screen_token: screenToken })

  if (error || !data) return { status: 'not-found' }
  return data as SchoolBoardPacket
})

// ── Tokens ────────────────────────────────────────────────────
export const getTodaySchoolTokens = cache(async (branchId: string): Promise<SchoolTokenDTO[]> => {
  const serviceDate = await getSchoolServiceDate(branchId)
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('school_tokens')
    .select('*')
    .eq('branch_id', branchId)
    .eq('service_date', serviceDate)
    .order('joined_at', { ascending: true })

  return (data as DbSchoolToken[] ?? []).map(toSchoolTokenDTO)
})

export interface SchoolTokenFilters {
  from?: string
  to?: string
  departmentId?: string
  status?: string
  search?: string
}

export async function getSchoolTokensPage(
  branchId: string,
  filters: SchoolTokenFilters,
  page = 1
): Promise<{ tokens: SchoolTokenDTO[]; total: number }> {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('school_tokens')
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

  const offset = (page - 1) * SCHOOL_TOKEN_PAGE_SIZE
  const { data, count } = await query
    .order('joined_at', { ascending: false })
    .range(offset, offset + SCHOOL_TOKEN_PAGE_SIZE - 1)

  return {
    tokens: (data as DbSchoolToken[] ?? []).map(toSchoolTokenDTO),
    total: count ?? 0,
  }
}

// ── Activity ──────────────────────────────────────────────────
export const getSchoolActivity = cache(async (branchId: string, limit = 30): Promise<SchoolActivityLogDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('school_activity_logs')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as DbSchoolActivityLog[] ?? []).map(toSchoolActivityLogDTO)
})

// ── Dashboard ─────────────────────────────────────────────────
// Wait time is called_at − joined_at: how long the visitor actually waited.
// (getDashboardStats in lib/dal/queue.ts measures completed_at − started_at,
// which is service duration, and labels it wait — don't copy that.)
export async function getSchoolDashboardStats(branchId: string): Promise<SchoolDashboardStats> {
  const [tokens, departments] = await Promise.all([
    getTodaySchoolTokens(branchId),
    getSchoolDepartments(branchId, { activeOnly: true }),
  ])

  const waitMinutes = (t: SchoolTokenDTO): number | null => {
    if (!t.calledAt) return null
    return Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
  }

  const avgOf = (list: SchoolTokenDTO[]): number => {
    const waits = list.map(waitMinutes).filter((m): m is number => m !== null && m >= 0)
    if (waits.length === 0) return 0
    return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
  }

  const byDepartment: SchoolDepartmentStats[] = departments.map((dept) => {
    const list = tokens.filter((t) => t.departmentId === dept.id)
    return {
      departmentId: dept.id,
      nameEn: dept.nameEn,
      nameAr: dept.nameAr,
      color: dept.color,
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
// reaching for is the top one, not the oldest in the queue.
//
// Not cache()d: the kiosk polls this through a server action and needs the
// current row set, not the one memoised for the request that rendered it.
const KIOSK_RECENT_LIMIT = 30

export async function getSchoolKioskFeed(branchToken: string): Promise<SchoolKioskFeed> {
  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, is_active')
    .eq('branch_token', branchToken)
    .maybeSingle()

  if (!branch || !(branch as { is_active: boolean }).is_active) return { status: 'not-found' }
  const branchId = (branch as { id: string }).id

  const { data: serviceDate } = await supabase.rpc('school_service_date', { p_branch_id: branchId })

  const [{ data: recent }, { data: waiting }, { count: issuedToday }] = await Promise.all([
    supabase
      .from('school_tokens')
      .select('*')
      .eq('branch_id', branchId)
      .eq('service_date', serviceDate as string)
      .order('joined_at', { ascending: false })
      .limit(KIOSK_RECENT_LIMIT),
    // Only the department column: this is a depth count per tile, and pulling
    // whole rows for a queue that can be hundreds long is wasted bandwidth on
    // a 6-second poll.
    supabase
      .from('school_tokens')
      .select('department_id')
      .eq('branch_id', branchId)
      .eq('service_date', serviceDate as string)
      .in('status', ['waiting', 'held']),
    supabase
      .from('school_tokens')
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
    recent: ((recent ?? []) as DbSchoolToken[]).map(toSchoolTokenDTO),
    waitingByDepartment,
    waitingTotal: waitingRows.length,
    issuedToday: issuedToday ?? 0,
  }
}

// ── Provider-owned branding ───────────────────────────────────
// One entry per branch of every school customer asked for, whether or not that
// branch has a school_settings row yet — the distributor panel needs to offer
// the field before the tenant has ever saved settings. Two bulk queries rather
// than one per customer, because /distributor/customers lists them all.
export async function getSchoolBranchIdentities(
  customerIds: string[]
): Promise<Record<string, SchoolBranchIdentity[]>> {
  if (customerIds.length === 0) return {}

  const supabase = createSupabaseServiceClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, customer_id, name')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: true })

  const branchRows = (branches ?? []) as { id: string; customer_id: string; name: string }[]
  if (branchRows.length === 0) return {}

  const { data: settings } = await supabase
    .from('school_settings')
    .select('branch_id, school_name_en, school_name_ar, logo_url')
    .in('branch_id', branchRows.map((b) => b.id))

  const byBranch = new Map(
    ((settings ?? []) as {
      branch_id: string; school_name_en: string; school_name_ar: string; logo_url: string
    }[]).map((r) => [r.branch_id, r])
  )

  const result: Record<string, SchoolBranchIdentity[]> = {}
  for (const branch of branchRows) {
    const row = byBranch.get(branch.id)
    ;(result[branch.customer_id] ??= []).push({
      branchId: branch.id,
      branchName: branch.name,
      customerId: branch.customer_id,
      schoolNameEn: row?.school_name_en ?? '',
      schoolNameAr: row?.school_name_ar ?? '',
      logoUrl: row?.logo_url ?? '',
    })
  }
  return result
}
