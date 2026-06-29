import { Suspense } from 'react'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranches } from '@/lib/dal/branches'
import { getDashboardStats } from '@/lib/dal/queue'
import { getRecentActivity } from '@/lib/dal/queue'
import { ActivityFeedServer } from '@/components/admin/ActivityFeedServer'
import { GitBranch, Users, Clock, CheckCircle2, TrendingUp, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await requireProfile()
  const branches = await getBranches(profile.customerId)

  // Get stats for the first branch if available (cross-branch overview for admin)
  const firstBranch = branches[0]
  const [stats, recentLogs] = firstBranch
    ? await Promise.all([
        getDashboardStats(firstBranch.id),
        getRecentActivity(firstBranch.id, 20),
      ])
    : [null, []]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {profile.fullName}
          </p>
        </div>
        <Link href="/branches">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            Manage Branches
          </Button>
        </Link>
      </div>

      {/* Branch cards */}
      {branches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <GitBranch className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No branches yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first branch to start managing queues</p>
          <Link href="/branches">
            <Button size="sm">Create Branch</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Link key={branch.id} href={`/branches/${branch.id}`}>
              <div className="rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-center justify-between mb-4">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GitBranch className="size-4 text-primary" />
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="font-semibold text-gray-900 truncate">{branch.name}</p>
                {branch.locationNote && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{branch.locationNote}</p>
                )}
                <div className="mt-3 flex items-center gap-1">
                  <span className={`size-2 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-xs text-muted-foreground">{branch.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stats + activity for first branch */}
      {stats && firstBranch && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">Today — {firstBranch.name}</h2>
            <Link href={`/branches/${firstBranch.id}`} className="text-xs text-primary hover:underline">
              View queue →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Today', value: stats.totalToday, icon: Users, accent: 'teal' },
              { label: 'Waiting', value: stats.waiting, icon: Clock, accent: 'amber' },
              { label: 'In Progress', value: stats.inProgress, icon: TrendingUp, accent: 'teal' },
              { label: 'Completed', value: stats.completed, icon: CheckCircle2, accent: 'emerald' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="rounded-xl border border-border bg-white p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${
                    accent === 'teal'   ? 'bg-teal-50 text-teal-600 border-teal-100' :
                    accent === 'amber'  ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    accent === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="text-3xl font-black text-gray-900 tabular-nums leading-none">{value}</p>
              </div>
            ))}
          </div>

          <div className="h-72">
            <ActivityFeedServer logs={recentLogs} />
          </div>
        </>
      )}
    </div>
  )
}
