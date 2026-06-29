'use client'

import { useTransition } from 'react'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { callNextAction, callEntryAction } from '@/lib/actions/queue'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { PhoneCall, SkipForward, PauseCircle, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/queueUtils'
import type { QueueEntryDTO } from '@/lib/db/types'
import { toggleQueuePauseAction } from '@/lib/actions/queue'

interface Props {
  branchId: string
  initialEntries: QueueEntryDTO[]
  initialServingNumber: number
  initialIsPaused?: boolean
}

export function LiveQueuePanel({ branchId, initialEntries, initialServingNumber, initialIsPaused }: Props) {
  const { entries, currentServingNumber, isPaused } = useRealtimeQueue(branchId, {
    entries: initialEntries,
    currentServingNumber: initialServingNumber,
    isPaused: initialIsPaused,
  })
  const [pending, startTransition] = useTransition()

  const waiting = entries.filter((e) => e.status === 'waiting').sort((a, b) => a.queueNumber - b.queueNumber)
  const inProgress = entries.find((e) => e.status === 'in-progress')

  function handleCallNext() {
    startTransition(async () => {
      const result = await callNextAction(branchId)
      if (result.error) toast.error(result.error)
    })
  }

  function handleCallEntry(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await callEntryAction(entry.id, branchId)
      if (result.error) toast.error(result.error)
      else toast.success(`Queue #${entry.queueNumber} called`)
    })
  }

  function handleTogglePause() {
    startTransition(async () => {
      const result = await toggleQueuePauseAction(branchId)
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Live Queue</h3>
          {isPaused && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              PAUSED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTogglePause}
            disabled={pending}
            className="h-8 text-xs gap-1.5"
          >
            {isPaused ? (
              <><PlayCircle className="size-3.5 text-green-600" />Resume</>
            ) : (
              <><PauseCircle className="size-3.5 text-amber-600" />Pause</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleCallNext}
            disabled={pending || waiting.length === 0 || isPaused}
            className="bg-primary hover:bg-primary/90 text-xs h-8 gap-1.5"
          >
            <SkipForward className="size-3.5" />
            Call Next
          </Button>
        </div>
      </div>

      {/* Now serving */}
      <div className="px-4 py-4 border-b border-border bg-indigo-50/50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Now Serving
        </p>
        {inProgress ? (
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black text-indigo-700 tabular-nums">
              #{inProgress.queueNumber}
            </span>
            <div>
              <p className="font-mono text-sm font-semibold text-gray-800">Bill {inProgress.billNumber}</p>
              <p className="text-xs text-muted-foreground">Called at {formatTime(inProgress.startedAt ?? inProgress.joinedAt)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No one being served</p>
        )}
      </div>

      {/* Queue list */}
      <div className="divide-y divide-border max-h-72 overflow-y-auto">
        {waiting.slice(0, 8).map((entry, i) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0">{i + 1}</span>
            <span className="font-mono font-black text-lg text-gray-900 tabular-nums w-10 shrink-0">
              #{entry.queueNumber}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-muted-foreground">Bill {entry.billNumber}</span>
              {entry.customerName && (
                <span className="ml-2 text-xs text-gray-500">{entry.customerName}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{formatTime(entry.joinedAt)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => handleCallEntry(entry)}
              disabled={pending || isPaused}
            >
              <PhoneCall className="size-3 mr-1" />
              Call
            </Button>
          </div>
        ))}

        {waiting.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Queue is empty
          </div>
        )}
      </div>

      {waiting.length > 8 && (
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
          <span className="text-xs text-muted-foreground">+{waiting.length - 8} more in queue →</span>
        </div>
      )}
    </div>
  )
}
