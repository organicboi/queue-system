import { requireSchoolContext } from '@/lib/dal/school-context'
import { getAds, getTickers } from '@/lib/dal/ads'
import { SchoolAdsManager } from '@/components/school/SchoolAdsManager'

export const dynamic = 'force-dynamic'

export default async function SchoolAdsPage() {
  const { profile, branch } = await requireSchoolContext()

  // The school board reuses the shared ads / ticker_messages tables, scoped to
  // the active campus — same source get_school_board reads from.
  const [ads, tickers] = await Promise.all([
    getAds(profile.customerId, branch.id),
    getTickers(profile.customerId, branch.id),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ads &amp; Media</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What plays on the waiting-area TVs at {branch.name}.
        </p>
      </div>
      <SchoolAdsManager branchId={branch.id} ads={ads} tickers={tickers} />
    </div>
  )
}
