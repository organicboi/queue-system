'use client'

import { useMemo, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'
import { ActivityFeedServer } from '@/components/admin/ActivityFeedServer'
import { DisplayClock } from '@/components/display/DisplayClock'
import { OwnerAnalytics } from '@/components/owner/OwnerAnalytics'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ActivityLogDTO, QueueEntryDTO } from '@/lib/db/types'

interface BranchStat {
  branchId: string
  branchName: string
  totalToday: number
  waiting: number
  inProgress: number
  completed: number
  cancelled: number
  noShow: number
  currentServingNumber: number
  isPaused: boolean
  screensCount: number
  avgWaitMinutes: number
}

interface OwnerDashboardProps {
  businessName: string
  logoUrl?: string
  branches: { id: string; name: string }[]
  branchStats: BranchStat[]
  entries: QueueEntryDTO[]
  activityLogs: ActivityLogDTO[]
}

const ALL = 'all'

export function OwnerDashboard({ businessName, logoUrl, branches, branchStats, entries, activityLogs }: OwnerDashboardProps) {
  const [selected, setSelected] = useState<string>(ALL)

  const scopedBranchStats = useMemo(
    () => (selected === ALL ? branchStats : branchStats.filter((b) => b.branchId === selected)),
    [branchStats, selected]
  )
  const scopedEntries = useMemo(
    () => (selected === ALL ? entries : entries.filter((e) => e.branchId === selected)),
    [entries, selected]
  )
  const scopedLogs = useMemo(
    () => (selected === ALL ? activityLogs : activityLogs.filter((l) => l.branchId === selected)),
    [activityLogs, selected]
  )

  const totals = useMemo(() => {
    return scopedBranchStats.reduce(
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
  }, [scopedBranchStats])
  const avgWaitMinutes = totals.waitWeight > 0 ? Math.round(totals.waitSum / totals.waitWeight) : 0
  const activeBranches = branchStats.filter((b) => !b.isPaused).length

  const focusedBranch = selected !== ALL ? branchStats.find((b) => b.branchId === selected) : undefined

  return (
    <div className="max-w-7xl mx-auto px-5 py-5 md:px-8 md:py-7 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <GitBranch className="size-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate leading-tight">{businessName}</p>
            <p className="text-xs text-muted-foreground">Owner overview</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <DisplayClock />
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-muted-foreground hover:text-red-500 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold text-gray-700">
          {focusedBranch ? focusedBranch.branchName : `All branches`}
        </h1>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger size="sm" className="w-48 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Focused branch hero */}
      {focusedBranch && (
        <div className="rounded-xl border border-border bg-white p-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Now serving</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">
              {focusedBranch.currentServingNumber || '—'}
            </p>
          </div>
          <span className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            focusedBranch.isPaused ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'
          )}>
            <span className={cn('size-1.5 rounded-full', focusedBranch.isPaused ? 'bg-gray-400' : 'bg-emerald-500')} />
            {focusedBranch.isPaused ? 'Paused' : 'Active'}
          </span>
        </div>
      )}

      {/* KPI strip */}
      <div className="rounded-xl border border-border bg-white grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border">
        {[
          { label: 'Customers today', value: totals.totalToday },
          { label: 'Waiting', value: totals.waiting },
          { label: 'Being served', value: totals.inProgress },
          { label: 'Completed', value: totals.completed },
          { label: 'Avg wait', value: avgWaitMinutes > 0 ? `${avgWaitMinutes}m` : '—' },
          ...(selected === ALL ? [{ label: 'Branches active', value: `${activeBranches}/${branchStats.length}` }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-4">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Branches table */}
      {selected === ALL && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Now serving</th>
                  <th className="px-5 py-3 font-medium text-right">Waiting</th>
                  <th className="px-5 py-3 font-medium text-right">Completed</th>
                  <th className="px-5 py-3 font-medium text-right">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {branchStats.map((b) => (
                  <tr
                    key={b.branchId}
                    onClick={() => setSelected(b.branchId)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{b.branchName}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('size-1.5 rounded-full', b.isPaused ? 'bg-gray-400' : 'bg-emerald-500')} />
                        {b.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-gray-900">
                      {b.currentServingNumber || '—'}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{b.waiting}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{b.completed}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {b.avgWaitMinutes > 0 ? `${b.avgWaitMinutes}m` : '—'}
                    </td>
                  </tr>
                ))}
                {branchStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No active branches yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Analytics</h2>
        <OwnerAnalytics entries={scopedEntries} />
      </div>

      {/* Activity */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Recent activity</h2>
        <div className="h-96">
          <ActivityFeedServer
            logs={scopedLogs}
            viewAllHref={selected === ALL ? '/owner/logs' : `/owner/logs?branchId=${selected}`}
          />
        </div>
      </div>
    </div>
  )
}
