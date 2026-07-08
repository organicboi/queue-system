'use client'

import { useCounterPresence } from '@/lib/hooks/useCounterPresence'
import { formatRelativeTime } from '@/lib/queueUtils'
import { WifiOff } from 'lucide-react'
import type { CounterType } from '@/lib/db/types'

interface Props {
  branchId: string
  selfCounterId: string
  enabled?: boolean
}

const TYPE_LABEL: Record<CounterType, string> = {
  order: 'Order',
  billing: 'Billing',
  kitchen: 'Kitchen',
  delivery: 'Delivery',
  call: 'Call',
}

// Warns staff at one counter when another active counter in the same
// branch appears offline (no heartbeat within the threshold) — e.g. the
// delivery counter isn't being watched, so ready orders may pile up
// unnoticed unless someone else steps in.
// Rendered as a slim full-width strip in the shell's banner slot.
export function CounterPresenceAlert({ branchId, selfCounterId, enabled = false }: Props) {
  const counters = useCounterPresence(branchId, enabled)

  const offlineSiblings = counters.filter(
    c => c.id !== selfCounterId && c.isActive && !c.isOnline
  )

  if (offlineSiblings.length === 0) return null

  return (
    <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2">
      <WifiOff className="size-3.5 text-amber-600 shrink-0" />
      <p className="text-xs text-amber-800 truncate min-w-0">
        <span className="font-bold">
          {offlineSiblings.length === 1 ? 'Counter offline: ' : `${offlineSiblings.length} counters offline: `}
        </span>
        {offlineSiblings.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ', '}
            {c.name} ({TYPE_LABEL[c.type]}
            {c.lastSeenAt ? `, ${formatRelativeTime(c.lastSeenAt)}` : ', never opened'})
          </span>
        ))}
        {' — cover their orders if needed.'}
      </p>
    </div>
  )
}
