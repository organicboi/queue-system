import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getDashboardStats, getTodayEntries, getRecentActivity, getQueueState } from '@/lib/dal/queue'
import { LiveQueuePanel } from '@/components/admin/LiveQueuePanel'
import { ActivityFeedServer } from '@/components/admin/ActivityFeedServer'
import { DashboardMetrics } from '@/components/admin/DashboardMetrics'
import { QueueTable } from '@/components/admin/QueueTable'
import { ChevronLeft, Settings, Tv, Image, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()

  const [branch, stats, queueState, entries, logs] = await Promise.all([
    getBranch(branchId, profile.customerId),
    getDashboardStats(branchId),
    getQueueState(branchId),
    getTodayEntries(branchId),
    getRecentActivity(branchId, 30),
  ])

  if (!branch) notFound()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/branches" className="text-muted-foreground hover:text-gray-700 transition-colors">
              <ChevronLeft className="size-4 inline" />
              <span className="text-xs">Branches</span>
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{branch.name}</h1>
          {branch.locationNote && (
            <p className="text-sm text-muted-foreground mt-0.5">{branch.locationNote}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/serve/${branchId}`} target="_blank">
            <Button variant="default" size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800">
              <MonitorSmartphone className="size-3.5" />
              Serve
            </Button>
          </Link>
          <Link href={`/branches/${branchId}/ads`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Image className="size-3.5" />
              Ads
            </Button>
          </Link>
          <Link href={`/branches/${branchId}/screens`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tv className="size-3.5" />
              Screens
            </Button>
          </Link>
          <Link href={`/branches/${branchId}/settings`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="size-3.5" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <DashboardMetrics stats={stats} avgServiceTime={branch.avgServiceTime} />

      {/* Queue panel + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            <LiveQueuePanel
              branchId={branchId}
              initialEntries={entries}
              initialServingNumber={queueState.currentServingNumber}
              initialIsPaused={queueState.isPaused}
            />
          </Suspense>
        </div>

        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            <ActivityFeedServer logs={logs} />
          </Suspense>
        </div>
      </div>

      {/* Full queue table */}
      <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
        <QueueTable branchId={branchId} initialEntries={entries} />
      </Suspense>
    </div>
  )
}
