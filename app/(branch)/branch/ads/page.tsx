import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAssignedBranch } from '@/lib/dal/users'
import { getAds, getTickers } from '@/lib/dal/ads'
import { AdsManager } from '@/components/admin/AdsManager'

export const dynamic = 'force-dynamic'

export default async function BranchAdsPage() {
  const profile = await requireBranchUser()
  const branch = await getAssignedBranch(profile)
  if (!branch) notFound()

  const [ads, tickers] = await Promise.all([
    getAds(profile.customerId, branch.id),
    getTickers(profile.customerId, branch.id),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Ads & Ticker</h1>
      <div className="max-w-3xl">
        <AdsManager branchId={branch.id} ads={ads} tickers={tickers} />
      </div>
    </div>
  )
}
