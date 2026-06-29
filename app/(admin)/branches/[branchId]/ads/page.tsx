import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { AdsManager } from '@/components/admin/AdsManager'
import { createSupabaseServerClient } from '@/lib/db/server'
import { ChevronLeft } from 'lucide-react'
import type { AdDTO, TickerMessageDTO } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchAdsPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getBranch(branchId, profile.customerId)

  if (!branch) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: rawAds }, { data: rawTickers }] = await Promise.all([
    supabase
      .from('ads')
      .select('*')
      .eq('branch_id', branchId)
      .eq('customer_id', profile.customerId)
      .order('display_order', { ascending: true }),
    supabase
      .from('ticker_messages')
      .select('*')
      .eq('branch_id', branchId)
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
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/branches/${branchId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 mb-2"
        >
          <ChevronLeft className="size-3.5" />
          Back to {branch.name}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Ads & Ticker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>

      <AdsManager branchId={branchId} ads={ads} tickers={tickers} />
    </div>
  )
}
