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

export const getUserBranchMap = cache(async (customerId: string): Promise<Record<string, BranchDTO[]>> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('user_branches')
    .select('user_id, branches(*)')
    .eq('customer_id', customerId)

  const map: Record<string, BranchDTO[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data as any[] ?? [])) {
    if (!row.branches) continue
    const branch = toBranchDTO(row.branches as DbBranch)
    if (!map[row.user_id]) map[row.user_id] = []
    map[row.user_id].push(branch)
  }
  return map
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

// A branch_user is always assigned to exactly one branch (enforced by the
// unique(user_id) constraint on user_branches). Use this instead of
// getAccessibleBranches(profile)[0] wherever a (branch)/branch/* page needs
// "the current staff member's branch."
export async function getAssignedBranch(profile: ProfileDTO): Promise<BranchDTO | null> {
  const branches = await getAccessibleBranches(profile)
  return branches[0] ?? null
}

// Resolves a branch only if the profile actually has access to it — admins
// see any branch of their customer, branch_users only their assigned ones
// (via user_branches). Prefer this over a bare getBranch(branchId, customerId)
// wherever a branch_user could otherwise reach a branch they aren't assigned to.
export async function getAccessibleBranch(profile: ProfileDTO, branchId: string): Promise<BranchDTO | null> {
  const branches = await getAccessibleBranches(profile)
  return branches.find((b) => b.id === branchId) ?? null
}
