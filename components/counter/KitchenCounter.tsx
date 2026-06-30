'use client'

import { useTransition } from 'react'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { counterUpdateKitchenStatusAction } from '@/lib/actions/counters'
import { ChefHat, Flame, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterName: string
  counterToken: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function PendingCard({ entry, onPreparing, onReady, pending }: {
  entry: QueueEntryDTO
  onPreparing: () => void
  onReady: () => void
  pending: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">New Order</span>
        <div className="flex items-center gap-1 text-xs text-amber-500">
          <Clock className="size-3" />
          {timeAgo(entry.joinedAt)}
        </div>
      </div>
      <div className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <span className="font-mono font-black text-gray-900 text-3xl md:text-4xl">{entry.queueNumber}</span>
          </div>
          <div className="flex-1 min-w-0">
            {entry.billNumber && (
              <p className="text-sm font-semibold text-gray-900">Bill #{entry.billNumber}</p>
            )}
            {entry.customerName && (
              <p className="text-sm text-gray-500 truncate mt-0.5">{entry.customerName}</p>
            )}
          </div>
        </div>
        {entry.notes && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-600 mt-0.5 shrink-0 text-sm">⚠</span>
            <p className="text-sm text-amber-700">{entry.notes}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <button
            onClick={onPreparing}
            disabled={pending}
            className="h-12 md:h-14 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all select-none disabled:opacity-40"
          >
            <Flame className="size-4 shrink-0" />
            Start Prep
          </button>
          <button
            onClick={onReady}
            disabled={pending}
            className="h-12 md:h-14 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all select-none disabled:opacity-40"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            Mark Ready
          </button>
        </div>
      </div>
    </div>
  )
}

function PreparingCard({ entry, onReady, pending }: {
  entry: QueueEntryDTO
  onReady: () => void
  pending: boolean
}) {
  return (
    <div className="bg-white border border-teal-200 rounded-xl overflow-hidden">
      <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-teal-700">
          <Flame className="size-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Cooking</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-teal-600">
          <Clock className="size-3" />
          {timeAgo(entry.joinedAt)}
        </div>
      </div>
      <div className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <span className="font-mono font-black text-gray-900 text-3xl md:text-4xl">{entry.queueNumber}</span>
          </div>
          <div className="flex-1 min-w-0">
            {entry.billNumber && (
              <p className="text-sm font-semibold text-gray-900">Bill #{entry.billNumber}</p>
            )}
            {entry.customerName && (
              <p className="text-sm text-gray-500 truncate mt-0.5">{entry.customerName}</p>
            )}
          </div>
        </div>
        {entry.notes && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-600 mt-0.5 shrink-0 text-sm">⚠</span>
            <p className="text-sm text-amber-700">{entry.notes}</p>
          </div>
        )}
        <button
          onClick={onReady}
          disabled={pending}
          className="w-full h-14 md:h-16 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all select-none disabled:opacity-40"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          Order Ready
        </button>
      </div>
    </div>
  )
}

export function KitchenCounter({ branchId, counterName, counterToken }: Props) {
  const { entries, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()

  const newOrders = entries
    .filter(e => e.status === 'waiting' && e.kitchenStatus === 'pending')
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const inPrep = entries
    .filter(e => e.status === 'waiting' && e.kitchenStatus === 'preparing')
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const readyCount = entries.filter(e => e.status === 'waiting' && e.kitchenStatus === 'ready').length
  const doneToday = entries.filter(e => e.status === 'completed').length

  function handleStatus(entry: QueueEntryDTO, newStatus: 'preparing' | 'ready') {
    startTransition(async () => {
      const result = await counterUpdateKitchenStatusAction(entry.id, branchId, newStatus, counterToken)
      if (result.error) toast.error(result.error)
      else if (newStatus === 'ready') toast.success(`#${entry.queueNumber} sent to billing`)
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <ChefHat className="size-5 text-teal-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-none mb-0.5">
                Kitchen
              </p>
              <h1 className="text-sm md:text-base font-semibold text-gray-900 leading-tight">{counterName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
            {newOrders.length > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-full px-2.5 py-1 text-xs font-semibold">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {newOrders.length}
                <span className="hidden sm:inline ml-0.5">new</span>
              </div>
            )}
            {inPrep.length > 0 && (
              <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2.5 py-1 text-xs font-semibold">
                <Flame className="size-3" />
                {inPrep.length}
                <span className="hidden sm:inline ml-0.5">cooking</span>
              </div>
            )}
            {readyCount > 0 && (
              <div className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 rounded-full px-2.5 py-1 text-xs font-semibold">
                <CheckCircle2 className="size-3" />
                {readyCount}
                <span className="hidden sm:inline ml-0.5">ready</span>
              </div>
            )}
            {doneToday > 0 && (
              <span className="hidden md:block text-xs text-gray-400 pl-1">{doneToday} done</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 md:px-4 lg:px-6 py-4 md:py-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <ChefHat className="size-10 mb-3 animate-pulse text-gray-300" />
            <p className="text-sm text-gray-500">Loading orders…</p>
          </div>
        ) : newOrders.length === 0 && inPrep.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center flex flex-col items-center">
            <div className="size-10 rounded-lg bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="size-5 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Kitchen is clear</p>
            <p className="text-sm text-gray-500 mt-1">New orders appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6 items-start">

            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">New Orders</h2>
                <span className="ml-auto text-[11px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                  {newOrders.length}
                </span>
              </div>
              {newOrders.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center text-center">
                  <p className="text-sm text-gray-400">No new orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newOrders.map(entry => (
                    <PendingCard
                      key={entry.id}
                      entry={entry}
                      pending={pending}
                      onPreparing={() => handleStatus(entry, 'preparing')}
                      onReady={() => handleStatus(entry, 'ready')}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Flame className="size-3 text-teal-600" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">In Preparation</h2>
                <span className="ml-auto text-[11px] font-semibold text-teal-700 bg-teal-50 rounded-full px-2 py-0.5">
                  {inPrep.length}
                </span>
              </div>
              {inPrep.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center text-center">
                  <p className="text-sm text-gray-400">Nothing cooking yet</p>
                  <p className="text-xs text-gray-400 mt-1">Tap &ldquo;Start Prep&rdquo; to move orders here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inPrep.map(entry => (
                    <PreparingCard
                      key={entry.id}
                      entry={entry}
                      pending={pending}
                      onReady={() => handleStatus(entry, 'ready')}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  )
}
