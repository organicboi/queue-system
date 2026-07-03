import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { ACTIVITY_LOG_PAGE_SIZE } from '@/lib/queueUtils'
import {
  toQueueEntryDTO, toActivityLogDTO,
  type QueueEntryDTO, type ActivityLogDTO, type QueueStateDTO, type DashboardStats,
  type DbQueueEntry, type DbActivityLog, type DbQueueState, type ActivityType,
} from '@/lib/db/types'

export interface ActivityLogFilters {
  type?: ActivityType | 'all'
  search?: string
  from?: string // ISO datetime, inclusive
  to?: string   // ISO datetime, exclusive
}

export interface ActivityLogPage {
  logs: ActivityLogDTO[]
  total: number
}

function sanitizeSearchTerm(search: string): string {
  return search.trim().replace(/[,()%*]/g, '')
}

function activityLogSearchFilter(search: string): string {
  const term = sanitizeSearchTerm(search)
  return /^\d+$/.test(term)
    ? `queue_number.eq.${term},bill_number.ilike.%${term}%,message.ilike.%${term}%`
    : `bill_number.ilike.%${term}%,message.ilike.%${term}%`
}

export const getQueueState = cache(async (branchId: string): Promise<QueueStateDTO> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('queue_state')
    .select('*')
    .eq('branch_id', branchId)
    .single()

  const row = (data as DbQueueState | null)
  return {
    id: row?.id ?? '',
    customerId: row?.customer_id ?? '',
    branchId: row?.branch_id ?? branchId,
    currentServingNumber: row?.current_serving_number ?? 0,
    nextQueueNumber: row?.next_queue_number ?? 1,
    isPaused: row?.is_paused ?? false,
    updatedAt: row?.updated_at ?? new Date().toISOString(),
  }
})

export const getTodayEntries = cache(async (branchId: string): Promise<QueueEntryDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('branch_id', branchId)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
    .order('queue_number', { ascending: true })

  return (data as DbQueueEntry[] ?? []).map(toQueueEntryDTO)
})

export const getRecentActivity = cache(async (branchId: string, limit = 30): Promise<ActivityLogDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as DbActivityLog[] ?? []).map(toActivityLogDTO)
})

export const getTodayEntriesForCustomer = cache(async (customerId: string, branchIds: string[]): Promise<QueueEntryDTO[]> => {
  if (branchIds.length === 0) return []

  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('customer_id', customerId)
    .in('branch_id', branchIds)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
    .order('queue_number', { ascending: true })

  return (data as DbQueueEntry[] ?? []).map(toQueueEntryDTO)
})

export const getRecentActivityForCustomer = cache(async (customerId: string, branchIds: string[], limit = 30): Promise<ActivityLogDTO[]> => {
  if (branchIds.length === 0) return []

  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('customer_id', customerId)
    .in('branch_id', branchIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as DbActivityLog[] ?? []).map(toActivityLogDTO)
})

export async function getActivityLogsPage(
  branchId: string,
  filters: ActivityLogFilters,
  page = 1
): Promise<ActivityLogPage> {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('branch_id', branchId)

  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lt('created_at', filters.to)
  if (filters.search?.trim()) query = query.or(activityLogSearchFilter(filters.search))

  const start = (Math.max(page, 1) - 1) * ACTIVITY_LOG_PAGE_SIZE
  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(start, start + ACTIVITY_LOG_PAGE_SIZE - 1)

  return {
    logs: (data as DbActivityLog[] ?? []).map(toActivityLogDTO),
    total: count ?? 0,
  }
}

export async function getActivityLogsPageForCustomer(
  customerId: string,
  branchIds: string[],
  filters: ActivityLogFilters & { branchId?: string },
  page = 1
): Promise<ActivityLogPage> {
  if (branchIds.length === 0) return { logs: [], total: 0 }

  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('customer_id', customerId)

  query = filters.branchId ? query.eq('branch_id', filters.branchId) : query.in('branch_id', branchIds)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lt('created_at', filters.to)
  if (filters.search?.trim()) query = query.or(activityLogSearchFilter(filters.search))

  const start = (Math.max(page, 1) - 1) * ACTIVITY_LOG_PAGE_SIZE
  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(start, start + ACTIVITY_LOG_PAGE_SIZE - 1)

  return {
    logs: (data as DbActivityLog[] ?? []).map(toActivityLogDTO),
    total: count ?? 0,
  }
}

const ACTIVITY_LOG_EXPORT_CAP = 5000

export async function getActivityLogsForExport(
  branchId: string,
  filters: ActivityLogFilters
): Promise<ActivityLogDTO[]> {
  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('branch_id', branchId)

  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lt('created_at', filters.to)
  if (filters.search?.trim()) query = query.or(activityLogSearchFilter(filters.search))

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LOG_EXPORT_CAP)

  return (data as DbActivityLog[] ?? []).map(toActivityLogDTO)
}

export async function getActivityLogsForExportByCustomer(
  customerId: string,
  branchIds: string[],
  filters: ActivityLogFilters & { branchId?: string }
): Promise<ActivityLogDTO[]> {
  if (branchIds.length === 0) return []

  const supabase = createSupabaseServiceClient()
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('customer_id', customerId)

  query = filters.branchId ? query.eq('branch_id', filters.branchId) : query.in('branch_id', branchIds)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lt('created_at', filters.to)
  if (filters.search?.trim()) query = query.or(activityLogSearchFilter(filters.search))

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LOG_EXPORT_CAP)

  return (data as DbActivityLog[] ?? []).map(toActivityLogDTO)
}

export const getDashboardStats = cache(async (branchId: string): Promise<DashboardStats> => {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('queue_entries')
    .select('status, started_at, completed_at')
    .eq('branch_id', branchId)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)

  const entries = (data ?? []) as { status: string; started_at: string | null; completed_at: string | null }[]

  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const completedWithTimes = entries.filter(
    e => e.status === 'completed' && e.started_at && e.completed_at
  )
  const avgWaitMinutes = completedWithTimes.length > 0
    ? Math.round(
        completedWithTimes.reduce((sum, e) => {
          const wait = (new Date(e.completed_at!).getTime() - new Date(e.started_at!).getTime()) / 60000
          return sum + wait
        }, 0) / completedWithTimes.length
      )
    : 0

  return {
    totalToday: entries.length,
    waiting: counts['waiting'] ?? 0,
    inProgress: counts['in-progress'] ?? 0,
    completed: counts['completed'] ?? 0,
    cancelled: counts['cancelled'] ?? 0,
    noShow: counts['no-show'] ?? 0,
    avgWaitMinutes,
  }
})
