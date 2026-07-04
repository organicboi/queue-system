import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getAccessibleBranch } from '@/lib/dal/users'
import { getCounters } from '@/lib/dal/counters'
import { getDashboardStats, getQueueState } from '@/lib/dal/queue'
import { BusinessHub } from '@/components/business/BusinessHub'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BusinessBranchPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getAccessibleBranch(profile, branchId)
  if (!branch) notFound()

  const [stats, queueState, counters] = await Promise.all([
    getDashboardStats(branchId),
    getQueueState(branchId),
    getCounters(profile.customerId, branchId),
  ])

  const manageCountersHref = profile.role === 'admin'
    ? `/branches/${branchId}/counters`
    : '/branch/counters'

  return (
    <BusinessHub
      branch={branch}
      businessName={profile.businessName ?? branch.name}
      stats={stats}
      isPaused={queueState.isPaused}
      counters={counters}
      manageCountersHref={manageCountersHref}
      modeHref={`/business/${branchId}/mode`}
    />
  )
}
