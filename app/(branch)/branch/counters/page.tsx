import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAssignedBranch } from '@/lib/dal/users'
import { getCounters } from '@/lib/dal/counters'
import { CountersManager } from '@/components/admin/CountersManager'

export const dynamic = 'force-dynamic'

export default async function BranchCountersPage() {
  const profile = await requireBranchUser()
  const branch = await getAssignedBranch(profile)
  if (!branch) notFound()

  const counters = await getCounters(profile.customerId, branch.id)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Counters</h1>
      <CountersManager branchId={branch.id} initialCounters={counters} presenceEnabled={branch.counterPresenceEnabled} />
    </div>
  )
}
