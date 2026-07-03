import { notFound } from 'next/navigation'
import { getCounterByToken } from '@/lib/dal/counters'
import { BillingCounter } from '@/components/counter/BillingCounter'
import { KitchenCounter } from '@/components/counter/KitchenCounter'
import { DeliveryCounter } from '@/components/counter/DeliveryCounter'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function CounterPage({ params }: Props) {
  const { token } = await params
  const counter = await getCounterByToken(token)

  if (!counter || !counter.isActive) notFound()

  if (counter.type === 'billing')  return <BillingCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} />
  if (counter.type === 'kitchen')  return <KitchenCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} />
  if (counter.type === 'delivery') return <DeliveryCounter branchId={counter.branchId} counterId={counter.id} counterName={counter.name} counterToken={token} />

  notFound()
}
