import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getActivityLogsPage, type ActivityLogFilters } from '@/lib/dal/queue'
import { exportActivityLogsAction } from '@/lib/actions/queue'
import { rangeToDates } from '@/lib/queueUtils'
import { ActivityLogExplorer } from '@/components/shared/ActivityLogExplorer'
import { BranchNav } from '@/components/admin/BranchNav'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
  searchParams: Promise<{ type?: string; range?: string; search?: string; page?: string }>
}

export default async function BranchLogsPage({ params, searchParams }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getBranch(branchId, profile.customerId)
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
  const { logs, total } = await getActivityLogsPage(branchId, filters, page)
  const exportForBranch = exportActivityLogsAction.bind(null, branchId)

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/branches/${branchId}`} className="text-muted-foreground hover:text-gray-700 transition-colors">
          <ChevronLeft className="size-4 inline" />
          <span className="text-xs">{branch.name}</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">Activity Log</h1>
      </div>

      <BranchNav branchId={branchId} active="logs" />

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
