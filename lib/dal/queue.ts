import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toQueueEntryDTO, toActivityLogDTO,
  type QueueEntryDTO, type ActivityLogDTO, type QueueStateDTO, type DashboardStats,
  type DbQueueEntry, type DbActivityLog, type DbQueueState,
} from '@/lib/db/types'

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
