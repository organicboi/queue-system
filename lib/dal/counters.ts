import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { toCounterDTO, type CounterDTO, type DbCounter } from '@/lib/db/types'

export const getCounters = cache(async (customerId: string, branchId: string): Promise<CounterDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('counters')
    .select('*')
    .eq('branch_id', branchId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  return (data as DbCounter[] ?? []).map(toCounterDTO)
})

export const getCounterByToken = cache(async (token: string): Promise<CounterDTO | null> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('counters')
    .select('*')
    .eq('counter_token', token)
    .single()

  if (!data) return null
  return toCounterDTO(data as DbCounter)
})

// Whether a branch runs a kitchen prep stage at all. Entries in branches with
// no active kitchen counter should never wait on kitchen_status — see
// lib/actions/queue.ts and lib/actions/counters.ts for where this gates entry
// creation and the billing/delivery call-next check.
export const hasActiveKitchenCounter = cache(async (branchId: string): Promise<boolean> => {
  const supabase = createSupabaseServiceClient()
  const { count } = await supabase
    .from('counters')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('type', 'kitchen')
    .eq('is_active', true)

  return (count ?? 0) > 0
})
