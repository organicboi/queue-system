import Link from 'next/link'
import { Users, Clock, TrendingUp, CheckCircle2 } from 'lucide-react'
import { requireProfile } from '@/lib/dal/session'
import { getBranches, getCustomerBranchStats } from '@/lib/dal/branches'
import { getRecentActivityForCustomer } from '@/lib/dal/queue'
import { ActivityFeedServer } from '@/components/admin/ActivityFeedServer'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const accents = {
  slate:  'bg-slate-100 text-slate-600 border-slate-200',
  amber:  'bg-amber-50 text-amber-600 border-amber-100',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
}

export default async function DashboardPage() {
  const profile = await requireProfile()

  const branches = await getBranches(profile.customerId)
  const activeBranchIds = branches.filter((b) => b.isActive).map((b) => b.id)

  const [branchStats, activityLogs] = await Promise.all([
    getCustomerBranchStats(profile.customerId),
    getRecentActivityForCustomer(profile.customerId, activeBranchIds, 20),
  ])

  const totals = branchStats.reduce(
    (acc, b) => {
      acc.totalToday += b.totalToday
      acc.waiting += b.waiting
      acc.inProgress += b.inProgress
      acc.completed += b.completed
      if (b.avgWaitMinutes > 0) {
        acc.waitSum += b.avgWaitMinutes * b.completed
        acc.waitWeight += b.completed
      }
      return acc
    },
    { totalToday: 0, waiting: 0, inProgress: 0, completed: 0, waitSum: 0, waitWeight: 0 }
  )
  const avgWaitMinutes = totals.waitWeight > 0 ? Math.round(totals.waitSum / totals.waitWeight) : 0
  const activeBranches = branchStats.filter((b) => !b.isPaused).length

  const cards = [
    { label: 'Total Today', value: totals.totalToday, icon: Users, accent: 'slate' as const, sub: 'customers, all branches' },
    { label: 'Waiting', value: totals.waiting, icon: Clock, accent: 'amber' as const, sub: 'across all branches' },
    { label: 'In Progress', value: totals.inProgress, icon: TrendingUp, accent: 'accent' as const, sub: 'being served now' },
    { label: 'Completed', value: totals.completed, icon: CheckCircle2, accent: 'accent' as const, sub: avgWaitMinutes > 0 ? `avg ${avgWaitMinutes}m wait` : 'today' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {branchStats.length} branch{branchStats.length === 1 ? '' : 'es'} · {activeBranches} active
        </p>
      </div>

      {/* KPI strip — aggregated across all branches */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, accent, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${accents[accent]}`}>
                <Icon className="size-4" />
              </span>
            </div>
            <div>
              <p className="text-3xl font-mono font-black text-slate-800 tabular-nums leading-none" dir="ltr">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Branch-by-branch status cards */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Branches</h2>
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            {branchStats.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No active branches yet</p>
            ) : (
              <div className="divide-y divide-border">
                {branchStats.map((b) => (
                  <Link
                    key={b.branchId}
                    href={`/branches/${b.branchId}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 active:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{b.branchName}</p>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-xs mt-0.5',
                        b.isPaused ? 'text-slate-500' : 'text-emerald-700'
                      )}>
                        <span className={cn('size-1.5 rounded-full', b.isPaused ? 'bg-slate-400' : 'bg-emerald-500')} />
                        {b.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-right shrink-0">
                      <div>
                        <p className="text-xs text-muted-foreground">Serving</p>
                        <p className="font-mono font-semibold text-slate-800 tabular-nums">{b.currentServingNumber || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Waiting</p>
                        <p className="font-mono font-semibold text-slate-800 tabular-nums">{b.waiting}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg wait</p>
                        <p className="font-mono font-semibold text-slate-800 tabular-nums">
                          {b.avgWaitMinutes > 0 ? `${b.avgWaitMinutes}m` : '—'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity across all branches */}
        <div className="lg:col-span-2 h-96">
          <ActivityFeedServer logs={activityLogs} />
        </div>
      </div>
    </div>
  )
}
