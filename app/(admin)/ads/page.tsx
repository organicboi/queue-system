import { requireAdmin } from '@/lib/dal/session'
import { getCommonAds } from '@/lib/dal/ads'
import { CommonAdsManager } from '@/components/admin/CommonAdsManager'

export const dynamic = 'force-dynamic'

export default async function CommonAdsPage() {
  const profile = await requireAdmin()
  const ads = await getCommonAds(profile.customerId)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Common Ads</h1>
      <CommonAdsManager ads={ads} />
    </div>
  )
}
