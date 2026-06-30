import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getCounters } from '@/lib/dal/counters'
import { CountersManager } from '@/components/admin/CountersManager'
import { BranchNav } from '@/components/admin/BranchNav'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchCountersPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireAdmin()
  const [branch, counters] = await Promise.all([
    getBranch(branchId, profile.customerId),
    getCounters(profile.customerId, branchId),
  ])

  if (!branch) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href="/branches" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 mb-1 w-fit">
            <ChevronLeft className="size-3.5" />
            Branches
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{branch.name}</h1>
        </div>
        <BranchNav branchId={branchId} active="counters" />
      </div>
      <CountersManager branchId={branchId} initialCounters={counters} />
    </div>
  )
}
