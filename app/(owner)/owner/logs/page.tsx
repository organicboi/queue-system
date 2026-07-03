import { requireProfile } from '@/lib/dal/session'
import { getBranches } from '@/lib/dal/branches'
import { getActivityLogsPageForCustomer, type ActivityLogFilters } from '@/lib/dal/queue'
import { exportActivityLogsForCustomerAction } from '@/lib/actions/queue'
import { rangeToDates } from '@/lib/queueUtils'
import { ActivityLogExplorer } from '@/components/shared/ActivityLogExplorer'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ type?: string; range?: string; search?: string; page?: string; branchId?: string }>
}

export default async function OwnerLogsPage({ searchParams }: Props) {
  const profile = await requireProfile()
  const branches = await getBranches(profile.customerId)
  const activeBranches = branches.filter((b) => b.isActive)
  const branchIds = activeBranches.map((b) => b.id)

  const sp = await searchParams
  const type = sp.type ?? 'all'
  const range = sp.range ?? '7d'
  const search = sp.search ?? ''
  const page = Math.max(1, Number(sp.page) || 1)
  const branchId = sp.branchId && branchIds.includes(sp.branchId) ? sp.branchId : undefined

  const filters: ActivityLogFilters & { branchId?: string } = {
    type: type as ActivityLogFilters['type'],
    search,
    branchId,
    ...rangeToDates(range),
  }
  const { logs, total } = await getActivityLogsPageForCustomer(profile.customerId, branchIds, filters, page)

  return (
    <div className="max-w-7xl mx-auto px-5 py-5 md:px-8 md:py-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All branches</p>
      </div>

      <ActivityLogExplorer
        logs={logs}
        total={total}
        page={page}
        filters={{ type, range, search }}
        branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))}
        selectedBranchId={branchId}
        exportAction={exportActivityLogsForCustomerAction}
        exportFileName="activity-log.csv"
      />
    </div>
  )
}
