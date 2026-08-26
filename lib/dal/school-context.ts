import 'server-only'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getBranches, getActiveBranchId } from '@/lib/dal/branches'
import type { BranchDTO, ProfileDTO } from '@/lib/db/types'

export interface SchoolContext {
  profile: ProfileDTO
  branches: BranchDTO[]
  branch: BranchDTO
}

// Every /school manager page starts here: it proves the tenant is actually a
// school, and resolves which campus the manager is looking at. The active
// branch is the same cookie the business product uses, so a user who switches
// campus stays switched across both.
export async function requireSchoolContext(): Promise<SchoolContext> {
  const profile = await requireProfile()
  if (profile.vertical !== 'school') redirect('/dashboard')

  const branches = await getBranches(profile.customerId)
  if (branches.length === 0) redirect('/onboard')

  const activeId = await getActiveBranchId(profile.customerId)
  const branch = branches.find((b) => b.id === activeId) ?? branches[0]

  return { profile, branches, branch }
}
