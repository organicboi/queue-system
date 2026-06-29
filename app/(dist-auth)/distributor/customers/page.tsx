import { requireDistributor } from '@/lib/dal/session'
import { getAllCustomers } from '@/lib/dal/customers'
import { DistributorCustomersManager } from '@/components/distributor/DistributorCustomersManager'
import { createSupabaseServiceClient } from '@/lib/db/server'

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage all tenant accounts</p>
      </div>
      <DistributorCustomersManager customers={customers} plans={plansData} />
    </div>
  )
}
