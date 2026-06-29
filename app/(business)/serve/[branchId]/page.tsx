import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getQueueState, getTodayEntries } from '@/lib/dal/queue'
import { ServePanel } from '@/components/admin/ServePanel'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function ServePage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()

  const [branch, queueState, entries] = await Promise.all([
    getBranch(branchId, profile.customerId),
    getQueueState(branchId),
    getTodayEntries(branchId),
  ])

  if (!branch) notFound()

  return (
    <ServePanel
      branchId={branchId}
      branchName={branch.name}
      businessName={profile.businessName ?? branch.name}
      silentPrintEnabled={branch.silentPrint}
      printerName={branch.printerName}
      initialEntries={entries}
      initialServingNumber={queueState.currentServingNumber}
      initialIsPaused={queueState.isPaused}
    />
  )
}
