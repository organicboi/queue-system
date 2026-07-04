import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAssignedBranch } from '@/lib/dal/users'
import { getDashboardStats, getTodayEntries, getRecentActivity, getQueueState } from '@/lib/dal/queue'
import { DashboardMetrics } from '@/components/admin/DashboardMetrics'
import { LiveQueuePanel } from '@/components/admin/LiveQueuePanel'
import { ActivityFeedServer } from '@/components/admin/ActivityFeedServer'
import { QueueTable } from '@/components/admin/QueueTable'

export const dynamic = 'force-dynamic'

export default async function BranchOverviewPage() {
  const profile = await requireBranchUser()
  const branch = await getAssignedBranch(profile)
  if (!branch) notFound()

  const [stats, queueState, entries, logs] = await Promise.all([
    getDashboardStats(branch.id),
    getQueueState(branch.id),
    getTodayEntries(branch.id),
    getRecentActivity(branch.id, 30),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{branch.name}</h1>
        {branch.locationNote && (
          <p className="text-sm text-muted-foreground mt-0.5">{branch.locationNote}</p>
        )}
      </div>

      <DashboardMetrics stats={stats} avgServiceTime={branch.avgServiceTime} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            <LiveQueuePanel
              branchId={branch.id}
              initialEntries={entries}
              initialServingNumber={queueState.currentServingNumber}
              initialIsPaused={queueState.isPaused}
            />
          </Suspense>
        </div>

        <div className="lg:col-span-2 h-96">
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            <ActivityFeedServer logs={logs} viewAllHref="/branch/logs" />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
        <QueueTable branchId={branch.id} initialEntries={entries} />
      </Suspense>
    </div>
  )
}
