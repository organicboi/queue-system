import { requireAdmin } from '@/lib/dal/session'
import { getCustomer } from '@/lib/dal/customers'
import { CustomerSettingsForm } from '@/components/admin/CustomerSettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await requireAdmin()
  const customer = await getCustomer(profile.customerId)

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your business information</p>
      </div>
      <CustomerSettingsForm customer={customer} />
    </div>
  )
}
