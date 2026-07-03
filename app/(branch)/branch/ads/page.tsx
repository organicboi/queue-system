import { notFound } from 'next/navigation'
import { requireBranchUser } from '@/lib/dal/session'
import { getAccessibleBranches } from '@/lib/dal/users'
import { createSupabaseServerClient } from '@/lib/db/server'
import { AdsManager } from '@/components/admin/AdsManager'
import type { AdDTO, TickerMessageDTO } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

export default async function BranchAdsPage() {
  const profile = await requireBranchUser()
  const branches = await getAccessibleBranches(profile)
  const branch = branches[0]
  if (!branch) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: rawAds }, { data: rawTickers }] = await Promise.all([
    supabase
      .from('ads')
      .select('*')
      .eq('branch_id', branch.id)
      .eq('customer_id', profile.customerId)
      .order('display_order', { ascending: true }),
    supabase
      .from('ticker_messages')
      .select('*')
      .eq('branch_id', branch.id)
      .eq('customer_id', profile.customerId)
      .order('display_order', { ascending: true }),
  ])

  const ads: AdDTO[] = (rawAds ?? []).map(r => ({
    id: r.id,
    customerId: r.customer_id,
    branchId: r.branch_id,
    name: r.name,
    fileUrl: r.file_url,
    fileType: r.file_type,
    fileSizeBytes: r.file_size_bytes,
    durationSeconds: r.duration_seconds,
    displayOrder: r.display_order,
    isActive: r.is_active,
    createdAt: r.created_at,
  }))

  const tickers: TickerMessageDTO[] = (rawTickers ?? []).map(r => ({
    id: r.id,
    customerId: r.customer_id,
    branchId: r.branch_id,
    message: r.message,
    displayOrder: r.display_order,
    isActive: r.is_active,
    createdAt: r.created_at,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Ads & Ticker</h1>
      <div className="max-w-3xl">
        <AdsManager branchId={branch.id} ads={ads} tickers={tickers} />
      </div>
    </div>
  )
}
