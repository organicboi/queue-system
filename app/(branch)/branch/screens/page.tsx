import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAccessibleBranches } from '@/lib/dal/users'
import { getScreens } from '@/lib/dal/screens'
import { ScreensManager } from '@/components/admin/ScreensManager'

export const dynamic = 'force-dynamic'

export default async function BranchScreensPage() {
  const profile = await requireBranchUser()
  const branches = await getAccessibleBranches(profile)
  const branch = branches[0]
  if (!branch) notFound()

  const screens = await getScreens(branch.id, profile.customerId)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Screens</h1>
      <ScreensManager branchId={branch.id} initialScreens={screens} />
    </div>
  )
}
