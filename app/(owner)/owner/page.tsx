import { requireProfile } from '@/lib/dal/session'
import { getBranches, getCustomerBranchStats } from '@/lib/dal/branches'
import { getRecentActivityForCustomer, getTodayEntriesForCustomer } from '@/lib/dal/queue'
import { OwnerDashboard } from '@/components/owner/OwnerDashboard'
import { AutoRefresh } from '@/components/owner/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function OwnerPage() {
  const profile = await requireProfile()
  const branches = await getBranches(profile.customerId)
  const branchIds = branches.filter(b => b.isActive).map(b => b.id)

  const [branchStats, activityLogs, entries] = await Promise.all([
    getCustomerBranchStats(profile.customerId),
    getRecentActivityForCustomer(profile.customerId, branchIds, 25),
    getTodayEntriesForCustomer(profile.customerId, branchIds),
  ])

  return (
    <>
      <AutoRefresh intervalMs={20000} />
      <OwnerDashboard
        businessName={profile.businessName ?? profile.customerName ?? 'My Business'}
        logoUrl={profile.logoUrl}
        branches={branches.filter(b => b.isActive).map(b => ({ id: b.id, name: b.name }))}
        branchStats={branchStats}
        entries={entries}
        activityLogs={activityLogs}
      />
    </>
  )
}
