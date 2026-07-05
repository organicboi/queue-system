import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import { getCounterByToken } from '@/lib/dal/counters'
import { getBranch } from '@/lib/dal/branches'
import { OrderCounter } from '@/components/counter/OrderCounter'
import { BillingCounter } from '@/components/counter/BillingCounter'
import { KitchenCounter } from '@/components/counter/KitchenCounter'
import { DeliveryCounter } from '@/components/counter/DeliveryCounter'

export const dynamic = 'force-dynamic'

// Dedicated staff terminal (8" tablet): lock zoom so fast repeated taps
// never trigger accidental pinch/double-tap zoom.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ token: string }>
}

export default async function CounterPage({ params }: Props) {
  const { token } = await params
  const counter = await getCounterByToken(token)

  if (!counter || !counter.isActive) notFound()

  const branch = await getBranch(counter.branchId, counter.customerId)
  const presenceEnabled = branch.counterPresenceEnabled

  if (counter.type === 'order') {
    return (
      <OrderCounter
        branchId={counter.branchId}
        counterId={counter.id}
        counterName={counter.name}
        counterToken={token}
        branchName={branch.name}
        silentPrintEnabled={branch.silentPrint}
        printerName={branch.printerName}
        presenceEnabled={presenceEnabled}
      />
    )
  }
  if (counter.type === 'billing')  return <BillingCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} presenceEnabled={presenceEnabled} />
  if (counter.type === 'kitchen')  return <KitchenCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} acceptingOrders={counter.acceptingOrders} presenceEnabled={presenceEnabled} />
  if (counter.type === 'delivery') return <DeliveryCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} presenceEnabled={presenceEnabled} />

  notFound()
}
