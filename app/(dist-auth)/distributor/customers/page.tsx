import { requireDistributor } from '@/lib/dal/session'
import { getAllCustomers } from '@/lib/dal/customers'
import { DistributorCustomersManager } from '@/components/distributor/DistributorCustomersManager'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { getSchoolBranchIdentities } from '@/lib/dal/school'

export const dynamic = 'force-dynamic'

export default async function DistributorCustomersPage() {
  await requireDistributor()
  const [customers, plansData] = await Promise.all([
    getAllCustomers(),
    (async () => {
      const supabase = createSupabaseServiceClient()
      const { data } = await supabase.from('plans').select('id, name').order('price_monthly')
      return data ?? []
    })(),
  ])

  // Name and logo are provider-owned now, so the panel edits them here. Only
  // school tenants have them.
  const identities = await getSchoolBranchIdentities(
    customers.filter((c) => c.vertical === 'school').map((c) => c.id)
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage all tenant accounts</p>
      </div>
      <DistributorCustomersManager
        customers={customers}
        plans={plansData}
        identities={identities}
      />
    </div>
  )
}
