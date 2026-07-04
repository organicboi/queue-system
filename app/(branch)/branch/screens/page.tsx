import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAssignedBranch } from '@/lib/dal/users'
import { getScreens } from '@/lib/dal/screens'
import { getAvailableAdsForBranch, getScreenAdsMap } from '@/lib/dal/ads'
import { ScreensManager } from '@/components/admin/ScreensManager'

export const dynamic = 'force-dynamic'

export default async function BranchScreensPage() {
  const profile = await requireBranchUser()
  const branch = await getAssignedBranch(profile)
  if (!branch) notFound()

  const [screens, availableAds, screenAdsMap] = await Promise.all([
    getScreens(branch.id, profile.customerId),
    getAvailableAdsForBranch(profile.customerId, branch.id),
    getScreenAdsMap(branch.id),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Screens</h1>
      <ScreensManager branchId={branch.id} initialScreens={screens} availableAds={availableAds} screenAdsMap={screenAdsMap} />
    </div>
  )
}
