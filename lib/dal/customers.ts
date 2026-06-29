import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toCustomerDTO, toPlanDTO,
  type CustomerDTO, type PlanDTO, type DbCustomer, type DbPlan,
} from '@/lib/db/types'

export const getCustomer = cache(async (customerId: string): Promise<CustomerDTO> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (error || !data) throw new Error('Customer not found')
  return toCustomerDTO(data as DbCustomer)
})

export const getCustomerWithPlan = cache(async (customerId: string): Promise<{ customer: CustomerDTO; plan: PlanDTO | null }> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*, plans(*)')
    .eq('id', customerId)
    .single()

  if (error || !data) throw new Error('Customer not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return {
    customer: toCustomerDTO(row as DbCustomer),
    plan: row.plans ? toPlanDTO(row.plans as DbPlan) : null,
  }
})

// Uses service role — distributor has no Supabase Auth session, RLS would block this
export const getAllCustomers = cache(async (): Promise<(CustomerDTO & { planName: string })[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('customers')
    .select('*, plans(name)')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[] ?? []).map(row => ({
    ...toCustomerDTO(row as DbCustomer),
    planName: (row.plans?.name ?? 'Unknown') as string,
  }))
})
