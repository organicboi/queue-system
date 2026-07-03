'use client'

import { useCounterPresence } from '@/lib/hooks/useCounterPresence'
import { formatRelativeTime } from '@/lib/queueUtils'
import { WifiOff } from 'lucide-react'
import type { CounterType } from '@/lib/db/types'

interface Props {
  branchId: string
  selfCounterId: string
}

const TYPE_LABEL: Record<CounterType, string> = {
  billing: 'Billing',
  kitchen: 'Kitchen',
  delivery: 'Delivery',
}

// Warns staff at one counter when another active counter in the same
// branch appears offline (no heartbeat within the threshold) — e.g. the
// delivery counter isn't being watched, so ready orders may pile up
// unnoticed unless someone else steps in.
export function CounterPresenceAlert({ branchId, selfCounterId }: Props) {
  const counters = useCounterPresence(branchId)

  const offlineSiblings = counters.filter(
    c => c.id !== selfCounterId && c.isActive && !c.isOnline
  )

  if (offlineSiblings.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <WifiOff className="size-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          {offlineSiblings.length === 1 ? 'A counter appears offline' : `${offlineSiblings.length} counters appear offline`}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {offlineSiblings.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              {c.name} ({TYPE_LABEL[c.type]})
              {c.lastSeenAt ? ` — last seen ${formatRelativeTime(c.lastSeenAt)}` : ' — never opened'}
            </span>
          ))}
          . You may need to cover their orders yourself.
        </p>
      </div>
    </div>
  )
}
