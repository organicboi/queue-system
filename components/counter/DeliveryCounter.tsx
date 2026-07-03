'use client'

import { useTransition } from 'react'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { useCounterHeartbeat } from '@/lib/hooks/useCounterPresence'
import {
  counterCallNextAction,
  counterCallEntryAction,
  counterCompleteEntryAction,
  counterCancelEntryAction,
} from '@/lib/actions/counters'
import { Truck, Phone, Clock, CheckCircle2, PackageCheck, ChefHat, SkipForward, BellRing, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/queueUtils'
import { CounterPresenceAlert } from '@/components/counter/CounterPresenceAlert'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterId: string
  counterName: string
  counterToken: string
}

export function DeliveryCounter({ branchId, counterId, counterName, counterToken }: Props) {
  const { entries, isPaused, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()
  useCounterHeartbeat(counterToken)

  const atCounter = entries.find(e => e.status === 'in-progress')

  const readyForDelivery = entries
    .filter(e => e.status === 'waiting' && e.kitchenStatus === 'ready')
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const inKitchen = entries.filter(
    e => e.status === 'waiting' && (e.kitchenStatus === 'pending' || e.kitchenStatus === 'preparing')
  ).length

  const totalWaiting = readyForDelivery.length + inKitchen

  const recentlyDelivered = entries
    .filter(e => e.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5)

  function handleCallNext() {
    startTransition(async () => {
      const result = await counterCallNextAction(branchId, counterToken)
      if (result.error) toast.error(result.error)
    })
  }

  function handleRecall(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCallEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`#${entry.queueNumber} recalled`)
    })
  }

  function handleDeliver(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCompleteEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`#${entry.queueNumber} delivered`)
    })
  }

  function handleCancel(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCancelEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`#${entry.queueNumber} cancelled`)
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <Truck className="size-5 text-teal-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-none mb-0.5">
                Delivery
              </p>
              <h1 className="text-sm md:text-base font-semibold text-gray-900 leading-tight">{counterName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {inKitchen > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-full px-2.5 py-1 text-xs font-semibold">
                <ChefHat className="size-3" />
                {inKitchen}
                <span className="hidden sm:inline ml-0.5">in kitchen</span>
              </div>
            )}
            {readyForDelivery.length > 0 && (
              <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2.5 py-1 text-xs font-semibold">
                <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                {readyForDelivery.length}
                <span className="hidden sm:inline ml-0.5">ready</span>
              </div>
            )}
            {isPaused && (
              <div className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Paused
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 md:px-4 lg:px-6 py-4 md:py-6 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Truck className="size-10 mb-3 animate-pulse text-gray-300" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        ) : (
          <>
            <CounterPresenceAlert branchId={branchId} selfCounterId={counterId} />

            {/* At Counter */}
            {atCounter && (
              <div className="bg-white border border-teal-200 rounded-xl overflow-hidden">
                <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    Out for Delivery Now
                  </span>
                </div>
                <div className="p-4 md:p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                      <span className="font-mono font-black text-gray-900 text-4xl md:text-5xl">
                        {atCounter.queueNumber}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      {atCounter.billNumber && (
                        <p className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                          Bill #{atCounter.billNumber}
                        </p>
                      )}
                      {atCounter.customerName ? (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{atCounter.customerName}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mt-0.5">No name provided</p>
                      )}
                      {atCounter.startedAt && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                          <Clock className="size-3" />
                          Called {formatTime(atCounter.startedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phone */}
                  {atCounter.phone ? (
                    <a
                      href={`tel:${atCounter.phone}`}
                      className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 hover:bg-teal-100 active:scale-95 transition-all select-none"
                    >
                      <div className="size-9 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                        <Phone className="size-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-teal-600 font-semibold uppercase tracking-wider mb-0.5">
                          Tap to Call
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                          {atCounter.phone}
                        </p>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
                      <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Phone className="size-4 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-400">No phone number</p>
                    </div>
                  )}

                  {/* Notes */}
                  {atCounter.notes && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                      <span className="text-amber-600 shrink-0 mt-0.5">⚠</span>
                      <p className="text-sm text-amber-700">{atCounter.notes}</p>
                    </div>
                  )}

                  {/* Recall */}
                  <button
                    onClick={() => handleRecall(atCounter)}
                    disabled={pending}
                    className="w-full h-11 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all select-none disabled:opacity-40"
                  >
                    <BellRing className="size-4" />
                    Recall
                  </button>

                  {((atCounter.callCount ?? 0) > 0 || (atCounter.recallCount ?? 0) > 0) && (
                    <p className="text-xs text-center text-gray-500 font-medium -mt-2">
                      Called <span className="text-gray-700 font-bold">{atCounter.callCount ?? 0}×</span>
                      {(atCounter.recallCount ?? 0) > 0 && (
                        <> · Recalled <span className="text-amber-600 font-bold">{atCounter.recallCount}×</span></>
                      )}
                    </p>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleDeliver(atCounter)}
                      disabled={pending}
                      className="col-span-3 h-12 md:h-14 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all select-none disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-5 shrink-0" />
                      Delivered
                    </button>
                    <button
                      onClick={() => handleCancel(atCounter)}
                      disabled={pending}
                      className="h-12 md:h-14 rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 font-semibold text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition-all select-none disabled:opacity-40"
                    >
                      <XCircle className="size-5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Call Next */}
            {readyForDelivery.length > 0 && (
              <button
                onClick={handleCallNext}
                disabled={pending || isPaused}
                className={`w-full rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all select-none disabled:opacity-40 ${
                  atCounter ? 'h-12 text-sm' : 'h-14 md:h-16 text-base'
                }`}
              >
                <SkipForward className="size-5 shrink-0" />
                {atCounter ? (
                  <>Call Next — #{readyForDelivery[0]?.queueNumber}</>
                ) : (
                  <>Call Next · Queue #{readyForDelivery[0]?.queueNumber}</>
                )}
              </button>
            )}

            {/* Ready queue list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Ready for Delivery
                </p>
                <span className="text-xs text-gray-400">
                  {readyForDelivery.length} order{readyForDelivery.length !== 1 ? 's' : ''}
                </span>
              </div>

              {readyForDelivery.length === 0 && !atCounter ? (
                <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center flex flex-col items-center">
                  {inKitchen > 0 ? (
                    <>
                      <div className="size-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
                        <ChefHat className="size-5 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {inKitchen} order{inKitchen > 1 ? 's' : ''} in kitchen
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Orders appear here once kitchen marks them ready
                      </p>
                    </>
                  ) : totalWaiting === 0 ? (
                    <>
                      <div className="size-10 rounded-lg bg-green-50 flex items-center justify-center mb-3">
                        <Truck className="size-5 text-green-600" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">All clear</p>
                      <p className="text-sm text-gray-500 mt-1">Kitchen-ready orders appear here</p>
                    </>
                  ) : null}
                </div>
              ) : (
                readyForDelivery.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl border p-3 md:p-4 flex items-center gap-3 ${
                      idx === 0 ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center shrink-0 ${
                      idx === 0 ? 'bg-teal-50 border border-teal-200' : 'bg-gray-100'
                    }`}>
                      <span className={`font-mono font-black text-xl md:text-2xl ${
                        idx === 0 ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {entry.queueNumber}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {entry.billNumber && (
                        <p className="text-sm font-semibold text-gray-900">Bill #{entry.billNumber}</p>
                      )}
                      {entry.customerName && (
                        <p className="text-xs text-gray-500 truncate">{entry.customerName}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Clock className="size-3" />
                        {formatTime(entry.joinedAt)}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 truncate">⚠ {entry.notes}</p>
                      )}
                    </div>
                    {idx === 0 && (
                      <div className="shrink-0 bg-teal-600 text-white rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
                        NEXT
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Recently delivered */}
            {recentlyDelivered.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 flex items-center gap-2">
                  <PackageCheck className="size-3.5" />
                  Recently Delivered
                </p>
                <div className="space-y-1.5">
                  {recentlyDelivered.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                    >
                      <div className="size-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="font-mono font-black text-base text-gray-300">{entry.queueNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.billNumber && (
                            <span className="text-sm text-gray-500">Bill #{entry.billNumber}</span>
                          )}
                          {entry.customerName && (
                            <span className="text-xs text-gray-400 truncate">{entry.customerName}</span>
                          )}
                        </div>
                        {entry.completedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Delivered {formatTime(entry.completedAt)}
                          </p>
                        )}
                      </div>
                      <PackageCheck className="size-4 text-green-500 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
