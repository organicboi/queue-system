import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { toProfileDTO, toBranchDTO, type ProfileDTO, type BranchDTO, type DbBranch } from '@/lib/db/types'

export const getUsers = cache(async (customerId: string): Promise<ProfileDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[] ?? []).map(row => toProfileDTO(row))
})

export const getUserBranches = cache(async (userId: string, customerId: string): Promise<string[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('user_branches')
    .select('branch_id')
    .eq('user_id', userId)
    .eq('customer_id', customerId)

  return (data ?? []).map(r => r.branch_id as string)
})

export const getAccessibleBranches = cache(async (profile: ProfileDTO): Promise<BranchDTO[]> => {
  const supabase = createSupabaseServiceClient()

  if (profile.role === 'admin') {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('customer_id', profile.customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    return (data as DbBranch[] ?? []).map(toBranchDTO)
  }

  const { data } = await supabase
    .from('user_branches')
    .select('branches(*)')
    .eq('user_id', profile.id)
    .eq('customer_id', profile.customerId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[] ?? [])
    .map(r => r.branches)
    .filter(Boolean)
    .map((b: DbBranch) => toBranchDTO(b))
})
