'use client'

import { useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { useCounterHeartbeat } from '@/lib/hooks/useCounterPresence'
import {
  counterCallNextAction,
  counterCallEntryAction,
  counterCompleteEntryAction,
  counterCancelEntryAction,
} from '@/lib/actions/counters'
import { Truck, Phone, CheckCircle2, PackageCheck, ChefHat, SkipForward, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/queueUtils'
import { CounterPresenceAlert } from '@/components/counter/CounterPresenceAlert'
import { ConsoleFrame, ConsoleLoading, TaskSplit, ElapsedPill, ConfirmCancel, useNow, minutesSince } from '@/components/counter/console'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterId: string
  counterName: string
  counterToken: string
  presenceEnabled?: boolean
}

/*
 * Delivery mirrors Billing's single-focus task shape (design system v5,
 * §5.2): one order out for delivery (or up next) at a time — no FIFO lane,
 * the list below the hero is informational.
 */
export function DeliveryCounter({ branchId, counterId, counterName, counterToken, presenceEnabled = false }: Props) {
  const { entries, isPaused, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()
  useCounterHeartbeat(counterToken, presenceEnabled)
  const now = useNow()

  const atCounter = entries.find(e => e.status === 'in-progress')

  const readyForDelivery = entries
    .filter(e => e.status === 'waiting' && e.kitchenStatus === 'ready')
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const next = readyForDelivery[0]

  const inKitchen = entries.filter(
    e => e.status === 'waiting' && (e.kitchenStatus === 'pending' || e.kitchenStatus === 'preparing')
  ).length

  const focus = atCounter ?? next
  const queueList = atCounter ? readyForDelivery : readyForDelivery.slice(1)

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
    <ConsoleFrame
      icon={Truck}
      name={counterName}
      typeLabel="Delivery · Dispatch Station"
      banner={<CounterPresenceAlert branchId={branchId} selfCounterId={counterId} enabled={presenceEnabled} />}
    >
      {isLoading ? (
        <ConsoleLoading icon={Truck} />
      ) : (
        <TaskSplit
          task={
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={focus ? `${focus.id}-${atCounter ? 'out' : 'next'}` : 'empty'}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="h-full"
              >
                {atCounter ? (
                  <OutForDeliveryHero
                    entry={atCounter}
                    now={now}
                    pending={pending}
                    onDeliver={() => handleDeliver(atCounter)}
                    onRecall={() => handleRecall(atCounter)}
                    onCancel={() => handleCancel(atCounter)}
                  />
                ) : next ? (
                  <UpNextHero entry={next} pending={pending} paused={isPaused} onCall={handleCallNext} />
                ) : (
                  <EmptyHero inKitchen={inKitchen} />
                )}
              </motion.div>
            </AnimatePresence>
          }
          list={
            <>
              <div className="flex items-center gap-2 px-1.5 pb-2 shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Ready for Delivery</p>
                <span className="ms-auto min-w-6 h-6 px-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center tabular-nums shadow-sm">
                  {queueList.length}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin space-y-2 px-0.5 pb-1">
                {queueList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
                    <div className="size-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                      <Truck className="size-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">{focus ? 'Nothing else waiting' : 'Nothing waiting'}</p>
                    <p className="text-xs mt-1 max-w-52">Kitchen-ready orders queue up here</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {queueList.map((entry, idx) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                      >
                        <QueueRow entry={entry} now={now} highlight={!!atCounter && idx === 0} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                {inKitchen > 0 && (
                  <div className="flex items-center gap-1.5 px-1 pt-2 text-xs text-slate-400">
                    <ChefHat className="size-3.5" />
                    {inKitchen} still in kitchen
                  </div>
                )}

                {recentlyDelivered.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                      <PackageCheck className="size-3.5 text-slate-400" />
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Recently Delivered</p>
                    </div>
                    {recentlyDelivered.map(entry => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-3 opacity-70">
                        <span className="w-12 text-center font-mono font-black text-xl tabular-nums text-slate-300 shrink-0" dir="ltr">
                          {entry.queueNumber}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-500 truncate">
                            {entry.billNumber ? `Bill #${entry.billNumber}` : '—'}
                            {entry.customerName && <span className="text-slate-400"> · {entry.customerName}</span>}
                          </p>
                          {entry.completedAt && (
                            <p className="text-xs text-slate-400 tabular-nums">Delivered {formatTime(entry.completedAt)}</p>
                          )}
                        </div>
                        <CheckCircle2 className="size-4 text-accent-600 shrink-0" />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          }
        />
      )}
    </ConsoleFrame>
  )
}

/* Out for delivery: flat white hero, tap-to-call, one accent CTA. */
function OutForDeliveryHero({ entry, now, pending, onDeliver, onRecall, onCancel }: {
  entry: QueueEntryDTO
  now: number
  pending: boolean
  onDeliver: () => void
  onRecall: () => void
  onCancel: () => void
}) {
  const mins = minutesSince(entry.startedAt ?? entry.joinedAt, now)
  return (
    <div className="h-full min-h-0 rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] flex flex-col p-5 gap-3">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-accent-600 animate-pulse" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Out for Delivery</span>
        <span className="ms-auto"><ElapsedPill mins={mins} /></span>
      </div>

      <div className="min-h-0">
        <p className="font-mono font-black tabular-nums text-slate-900 leading-[0.82] text-[clamp(3.5rem,15vh,7rem)]" dir="ltr">
          {entry.queueNumber}
        </p>
        <p className="text-2xl font-bold text-slate-800 mt-2">{entry.billNumber ? `Bill #${entry.billNumber}` : 'No bill #'}</p>
        <p className="text-slate-500 truncate">{entry.customerName || 'No name'}</p>
        {((entry.callCount ?? 0) > 1 || (entry.recallCount ?? 0) > 0) && (
          <p className="text-slate-400 text-xs mt-1">
            Called {entry.callCount ?? 0}×{(entry.recallCount ?? 0) > 0 && ` · Recalled ${entry.recallCount}×`}
          </p>
        )}
      </div>

      {entry.phone ? (
        <a
          href={`tel:${entry.phone}`}
          className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 active:bg-slate-100 active:scale-[0.98] transition-all"
        >
          <div className="size-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
            <Phone className="size-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Tap to Call</p>
            <p className="text-lg font-bold text-slate-800 leading-tight tabular-nums" dir="ltr">{entry.phone}</p>
          </div>
        </a>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-400 px-1">
          <Phone className="size-4" />
          No phone number
        </div>
      )}

      {entry.notes && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <span className="shrink-0">⚠</span>
          <span className="leading-5">{entry.notes}</span>
        </div>
      )}

      <div className="mt-auto space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={onRecall}
            className="h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center gap-2 select-none transition-all duration-[250ms] ease-out active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 shadow-sm active:bg-slate-50"
          >
            <BellRing className="size-4.5" />
            Recall
          </button>
          <ConfirmCancel disabled={pending} onConfirm={onCancel} />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onDeliver}
          className="w-full h-14 rounded-2xl bg-accent-600 text-white text-base font-bold flex items-center justify-center gap-2 select-none transition-all duration-[250ms] ease-out active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)] active:bg-accent-700"
        >
          <CheckCircle2 className="size-5" />
          Delivered
        </button>
      </div>
    </div>
  )
}

/* Up next: flat white hero, single primary CTA to call. */
function UpNextHero({ entry, pending, paused, onCall }: {
  entry: QueueEntryDTO
  pending: boolean
  paused: boolean
  onCall: () => void
}) {
  return (
    <div className="h-full min-h-0 rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] flex flex-col p-5">
      <div className="flex items-center">
        <span className="inline-flex items-center h-7 rounded-full bg-accent-50 text-accent-700 border border-accent-200 px-2.5 text-xs font-bold">
          Up Next
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <p className="font-mono font-black tabular-nums text-slate-900 leading-[0.82] text-[clamp(4.5rem,20vh,9rem)]" dir="ltr">
          {entry.queueNumber}
        </p>
        <p className="text-2xl font-bold text-slate-800 mt-2">{entry.billNumber ? `Bill #${entry.billNumber}` : 'No bill #'}</p>
        <p className="text-slate-500 truncate">{entry.customerName || 'No name'}</p>
        {entry.notes && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <span className="shrink-0">⚠</span>
            <span className="leading-5">{entry.notes}</span>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={pending || paused}
          onClick={onCall}
          className="w-full h-14 rounded-2xl bg-accent-600 text-white text-base font-bold flex items-center justify-center gap-2 select-none transition-all duration-[250ms] ease-out active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)] active:bg-accent-700"
        >
          <SkipForward className="size-5" />
          Call #{entry.queueNumber}
        </button>
        {paused && <p className="text-center text-xs font-semibold text-amber-600 mt-2">Queue is paused</p>}
      </div>
    </div>
  )
}

/* Nothing to deliver: calm empty card. */
function EmptyHero({ inKitchen }: { inKitchen: number }) {
  const kitchen = inKitchen > 0
  return (
    <div className="h-full min-h-0 rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] flex flex-col items-center justify-center text-center p-6">
      <div className={`size-16 rounded-2xl flex items-center justify-center mb-3 ${kitchen ? 'bg-amber-50 text-amber-600' : 'bg-accent-50 text-accent-700'}`}>
        {kitchen ? <ChefHat className="size-7" /> : <CheckCircle2 className="size-7" />}
      </div>
      <p className="text-lg font-bold text-slate-700">
        {kitchen ? `${inKitchen} order${inKitchen > 1 ? 's' : ''} in kitchen` : 'All clear'}
      </p>
      <p className="text-sm text-slate-400 mt-1 max-w-64">
        {kitchen ? 'They appear here once the kitchen marks them ready' : 'Kitchen-ready orders show up here automatically'}
      </p>
    </div>
  )
}

/* A ready order in the queue list: mono number, bill/name, wait pill. */
function QueueRow({ entry, now, highlight = false }: {
  entry: QueueEntryDTO
  now: number
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-2.5 flex items-center gap-3 ${
      highlight ? 'bg-accent-50 border-accent-300' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <span className="size-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-mono font-black text-xl tabular-nums shrink-0" dir="ltr">
        {entry.queueNumber}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">
          {entry.billNumber ? `Bill #${entry.billNumber}` : '—'}
        </p>
        <p className="text-sm text-slate-400 truncate">
          {entry.customerName || 'No name'}
          {entry.notes && <span className="text-amber-600"> · ⚠ {entry.notes}</span>}
        </p>
      </div>
      <ElapsedPill mins={minutesSince(entry.joinedAt, now)} />
    </div>
  )
}
