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
