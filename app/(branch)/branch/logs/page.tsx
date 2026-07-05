import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAssignedBranch } from '@/lib/dal/users'
import { getActivityLogsPage, type ActivityLogFilters } from '@/lib/dal/queue'
import { exportActivityLogsAction } from '@/lib/actions/queue'
import { rangeToDates } from '@/lib/queueUtils'
import { ActivityLogExplorer } from '@/components/shared/ActivityLogExplorer'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ type?: string; range?: string; search?: string; page?: string }>
}

export default async function BranchOperatorLogsPage({ searchParams }: Props) {
  const profile = await requireBranchUser()
  const branch = await getAssignedBranch(profile)
  if (!branch) notFound()

  const sp = await searchParams
  const type = sp.type ?? 'all'
  const range = sp.range ?? '7d'
  const search = sp.search ?? ''
  const page = Math.max(1, Number(sp.page) || 1)

  const filters: ActivityLogFilters = {
    type: type as ActivityLogFilters['type'],
    search,
    ...rangeToDates(range),
  }
  const { logs, total } = await getActivityLogsPage(branch.id, filters, page)
  const exportForBranch = exportActivityLogsAction.bind(null, branch.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>

      <ActivityLogExplorer
        logs={logs}
        total={total}
        page={page}
        filters={{ type, range, search }}
        exportAction={exportForBranch}
        exportFileName={`${branch.name.replace(/\s+/g, '-').toLowerCase()}-activity-log.csv`}
      />
    </div>
  )
}
