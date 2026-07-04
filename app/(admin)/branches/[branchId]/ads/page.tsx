import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getAds, getTickers } from '@/lib/dal/ads'
import { AdsManager } from '@/components/admin/AdsManager'
import { ChevronLeft } from 'lucide-react'
import { BranchNav } from '@/components/admin/BranchNav'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchAdsPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getBranch(branchId, profile.customerId)

  if (!branch) notFound()

  const [ads, tickers] = await Promise.all([
    getAds(profile.customerId, branchId),
    getTickers(profile.customerId, branchId),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href="/branches" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 mb-1 w-fit">
            <ChevronLeft className="size-3.5" />
            Branches
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{branch.name}</h1>
        </div>
        <BranchNav branchId={branchId} active="ads" />
      </div>

      <div className="max-w-3xl">
        <AdsManager branchId={branchId} ads={ads} tickers={tickers} />
      </div>
    </div>
  )
}
