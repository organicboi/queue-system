import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { getAccessibleBranch } from '@/lib/dal/users'
import { getQueueState, getTodayEntries } from '@/lib/dal/queue'
import { BusinessModePanel } from '@/components/business/BusinessModePanel'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BusinessModePage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getAccessibleBranch(profile, branchId)
  if (!branch) notFound()

  const [queueState, entries] = await Promise.all([
    getQueueState(branchId),
    getTodayEntries(branchId),
  ])

  return (
    <BusinessModePanel
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
