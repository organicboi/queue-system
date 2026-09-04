import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getAds, getTickers } from '@/lib/dal/ads'
import { SchoolAdsManager } from '@/components/school/SchoolAdsManager'

export const dynamic = 'force-dynamic'

// The hospital board reuses the shared ads / ticker_messages tables and the
// generic ad actions, so the school manager (which is itself product-neutral —
// it only talks to @/lib/actions/ads) drives it unchanged. Health-awareness
// clips are the natural ad inventory here.
export default async function HospitalAdsPage() {
  const { profile, branch } = await requireHospitalContext()
  const [ads, tickers] = await Promise.all([
    getAds(profile.customerId, branch.id),
    getTickers(profile.customerId, branch.id),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ads &amp; Media</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What plays on the waiting-area TVs at {branch.name}. Side-panel ads run
          alongside the room list; fullscreen ads take over the whole screen for
          1 minute right after a token is called, then the board returns to normal.
        </p>
      </div>
      <SchoolAdsManager branchId={branch.id} ads={ads} tickers={tickers} placementEditable />
    </div>
  )
}
