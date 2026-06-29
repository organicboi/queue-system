import { requireProfile } from '@/lib/dal/session'
import { getBranches } from '@/lib/dal/branches'
import { getTodayEntries, getDashboardStats } from '@/lib/dal/queue'
import { AnalyticsView } from '@/components/admin/AnalyticsView'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const profile = await requireProfile()
  const branches = await getBranches(profile.customerId)
  const firstBranch = branches[0]

  const [entries, stats] = firstBranch
    ? await Promise.all([
        getTodayEntries(firstBranch.id),
        getDashboardStats(firstBranch.id),
      ])
    : [[], { totalToday: 0, waiting: 0, inProgress: 0, completed: 0, cancelled: 0, noShow: 0, avgWaitMinutes: 0 }]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {firstBranch ? `${firstBranch.name} — today's performance` : 'No branches yet'}
        </p>
      </div>
      <AnalyticsView entries={entries} stats={stats} />
    </div>
  )
}
