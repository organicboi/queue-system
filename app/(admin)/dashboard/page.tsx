import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getActiveBranchId } from '@/lib/dal/branches'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await requireProfile()
  const activeBranchId = await getActiveBranchId(profile.customerId)

  if (!activeBranchId) redirect('/branches')
  redirect(`/branches/${activeBranchId}`)
}
