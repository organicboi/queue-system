import { requireDistributor } from '@/lib/dal/session'
import { LicenseKeysManager } from '@/components/distributor/LicenseKeysManager'
import { createSupabaseServiceClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export default async function DistributorKeysPage() {
  await requireDistributor()
  const supabase = createSupabaseServiceClient()

  const [{ data: keys }, { data: plans }] = await Promise.all([
    supabase.from('license_keys').select('*').order('created_at', { ascending: false }),
    supabase.from('plans').select('id, name').order('price_monthly'),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">License Keys</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate and track onboarding keys</p>
      </div>
      <LicenseKeysManager keys={keys ?? []} plans={plans ?? []} />
    </div>
  )
}
