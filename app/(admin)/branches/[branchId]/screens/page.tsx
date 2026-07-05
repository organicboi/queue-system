import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getScreens } from '@/lib/dal/screens'
import { getAvailableAdsForBranch, getScreenAdsMap } from '@/lib/dal/ads'
import { ScreensManager } from '@/components/admin/ScreensManager'
import { ChevronLeft } from 'lucide-react'
import { BranchNav } from '@/components/admin/BranchNav'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchScreensPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const [branch, screens, availableAds, screenAdsMap] = await Promise.all([
    getBranch(branchId, profile.customerId),
    getScreens(branchId, profile.customerId),
    getAvailableAdsForBranch(profile.customerId, branchId),
    getScreenAdsMap(branchId),
  ])

  if (!branch) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href="/branches" className="flex items-center gap-1 text-xs text-muted-foreground active:text-slate-700 mb-1 w-fit">
            <ChevronLeft className="size-3.5" />
            Branches
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">{branch.name}</h1>
        </div>
        <BranchNav branchId={branchId} active="screens" />
      </div>
      <ScreensManager branchId={branchId} initialScreens={screens} availableAds={availableAds} screenAdsMap={screenAdsMap} />
    </div>
  )
}
