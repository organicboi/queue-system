import 'server-only'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getBranches, getActiveBranchId } from '@/lib/dal/branches'
import type { BranchDTO, ProfileDTO } from '@/lib/db/types'

export interface HospitalContext {
  profile: ProfileDTO
  branches: BranchDTO[]
  branch: BranchDTO
}

// Every /hospital manager page starts here: it proves the tenant is actually
// a hospital, and resolves which facility the manager is looking at. The
// active branch is the same cookie the other products use, so a user who
// switches facility stays switched across all of them.
export async function requireHospitalContext(): Promise<HospitalContext> {
  const profile = await requireProfile()
  if (profile.vertical !== 'hospital') redirect('/dashboard')

  const branches = await getBranches(profile.customerId)
  if (branches.length === 0) redirect('/onboard')

  const activeId = await getActiveBranchId(profile.customerId)
  const branch = branches.find((b) => b.id === activeId) ?? branches[0]

  return { profile, branches, branch }
}
