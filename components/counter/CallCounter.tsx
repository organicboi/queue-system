'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Megaphone, Delete, BellRing, CheckCircle2, PhoneCall } from 'lucide-react'
import { toast } from 'sonner'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { useCounterHeartbeat } from '@/lib/hooks/useCounterPresence'
import {
  counterCreateEntryAction,
  counterCallEntryAction,
  counterCompleteEntryAction,
  counterCancelEntryAction,
} from '@/lib/actions/counters'
import { CounterPresenceAlert } from '@/components/counter/CounterPresenceAlert'
import {
  ConsoleFrame,
  ConsoleLoading,
  TaskSplit,
  KeypadKey,
  ElapsedPill,
  ConfirmCancel,
  useNow,
  minutesSince,
} from '@/components/counter/console'
import { formatTime } from '@/lib/queueUtils'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterId: string
  counterName: string
  counterToken: string
  presenceEnabled?: boolean
}

const MAX_BILL_LENGTH = 12

/*
 * Call counter — a keypad-driven paging station. Staff type any bill number
 * (whether or not it's already in the queue) and tap Call: the bill is
 * registered as an immediately-ready entry (kitchen stage skipped, like
 * Delivery) and called straight to the display. The right panel is the live
 * "Now Calling" screen plus the recent-calls log. There's no FIFO lane and no
 * ready queue to work through — the operator drives every call by hand.
 */
export function CallCounter({ branchId, counterId, counterName, counterToken, presenceEnabled = false }: Props) {
  const { entries, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()
  const [billNumber, setBillNumber] = useState('')
  useCounterHeartbeat(counterToken, presenceEnabled)
  const now = useNow()

  // The branch's single current call (shared current-serving slot, same as
  // billing/delivery). Calling a new bill auto-completes whatever was here.
  const nowCalling = entries.find(e => e.status === 'in-progress')

  const recentCalls = entries
    .filter(e => e.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 8)

  function append(text: string) {
    setBillNumber(prev => (prev + text).slice(0, MAX_BILL_LENGTH))
  }

  // Register the typed bill as a ready entry and immediately call it — one
  // tap covers "not in the queue → now on the display".
  function handleCall() {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await counterCreateEntryAction(branchId, counterToken, trimmed)
      if (result.error || !result.entry) {
        toast.error(result.error ?? 'Failed to call bill')
        return
      }
      const callResult = await counterCallEntryAction(result.entry.id, branchId, counterToken)
      if (callResult.error) toast.error(callResult.error)
      else toast.success(`Calling Bill #${result.entry.billNumber}`)
      setBillNumber('')
    })
  }

  function handleRecall(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCallEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`Bill #${entry.billNumber} recalled`)
    })
  }

  function handleComplete(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCompleteEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`Bill #${entry.billNumber} done`)
    })
  }

  function handleCancel(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCancelEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`Bill #${entry.billNumber} cancelled`)
    })
  }

  return (
    <ConsoleFrame
      icon={Megaphone}
      name={counterName}
      typeLabel="Call · Paging Station"
      banner={<CounterPresenceAlert branchId={branchId} selfCounterId={counterId} enabled={presenceEnabled} />}
    >
      {isLoading ? (
        <ConsoleLoading icon={Megaphone} />
      ) : (
        <TaskSplit
          task={
            <div className="h-full flex flex-col rounded-3xl border border-slate-200 bg-white p-4 gap-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]">
              <h2 className="text-lg font-bold text-slate-800 leading-tight text-center shrink-0">Enter Bill Number</h2>

              {/* Bill display — fed by the on-screen pad; virtual keyboard suppressed. */}
              <div className="relative shrink-0 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-600/10 transition-colors">
                <input
                  type="text"
                  inputMode="none"
                  placeholder="Bill number"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value.slice(0, MAX_BILL_LENGTH))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCall()}
                  className="w-full h-[4.5rem] bg-transparent text-center text-5xl font-mono font-black tracking-wider tabular-nums text-slate-900 placeholder:text-lg placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none"
                />
              </div>

              {/* Keypad: neutral keys + tall accent Call. */}
              <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-2 min-h-0">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <KeypadKey key={d} onTap={() => append(d)} disabled={pending}>{d}</KeypadKey>
                  ))}
                  <KeypadKey variant="danger" onTap={() => setBillNumber('')} disabled={pending}>Clear</KeypadKey>
                  <KeypadKey onTap={() => append('0')} disabled={pending}>0</KeypadKey>
                  <KeypadKey variant="muted" onTap={() => setBillNumber(prev => prev.slice(0, -1))} disabled={pending} aria-label="Backspace">
                    <Delete className="size-6" />
                  </KeypadKey>
                </div>
                <button
                  type="button"
                  onClick={handleCall}
                  disabled={!billNumber.trim() || pending}
                  className="rounded-2xl bg-accent-600 text-white flex flex-col items-center justify-center gap-2 select-none transition active:translate-y-px active:bg-accent-700 disabled:opacity-40 disabled:active:translate-y-0 shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]"
                >
                  <Megaphone className="size-8" />
                  <span className="text-base font-bold uppercase tracking-wide leading-tight text-center px-1">Call</span>
                </button>
              </div>
            </div>
          }
          list={
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {/* Now-calling screen */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={nowCalling ? nowCalling.id : 'empty'}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="shrink-0"
                >
                  {nowCalling ? (
                    <NowCallingCard
                      entry={nowCalling}
                      now={now}
                      pending={pending}
                      onRecall={() => handleRecall(nowCalling)}
                      onDone={() => handleComplete(nowCalling)}
                      onCancel={() => handleCancel(nowCalling)}
                    />
                  ) : (
                    <div className="rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] flex flex-col items-center justify-center text-center p-6">
                      <div className="size-16 rounded-2xl bg-accent-50 text-accent-700 flex items-center justify-center mb-3">
                        <Megaphone className="size-7" />
                      </div>
                      <p className="text-lg font-bold text-slate-700">Nothing on call</p>
                      <p className="text-sm text-slate-400 mt-1 max-w-64">Type a bill number and tap Call to page it</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Recent calls log */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center gap-2 px-1.5 pb-2 shrink-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent Calls</p>
                  <span className="ms-auto min-w-6 h-6 px-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center tabular-nums shadow-sm">
                    {recentCalls.length}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin space-y-2 px-0.5 pb-1">
                  {recentCalls.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
                      <div className="size-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                        <PhoneCall className="size-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No calls yet</p>
                      <p className="text-xs mt-1">Bills you call appear here</p>
                    </div>
                  ) : (
                    recentCalls.map(entry => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-3">
                        <span className="size-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-mono font-black text-lg tabular-nums shrink-0" dir="ltr">
                          {entry.queueNumber}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {entry.billNumber ? `Bill #${entry.billNumber}` : '—'}
                          </p>
                          {entry.completedAt && (
                            <p className="text-xs text-slate-400 tabular-nums">Called {formatTime(entry.completedAt)}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRecall(entry)}
                          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:bg-slate-50 active:scale-95 transition disabled:opacity-40 shrink-0"
                        >
                          <BellRing className="size-3.5" />
                          Recall
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          }
        />
      )}
    </ConsoleFrame>
  )
}

/* The live call: bill number huge (the paging identity), queue number
   secondary, with Recall / Done and a guarded Cancel. */
function NowCallingCard({ entry, now, pending, onRecall, onDone, onCancel }: {
  entry: QueueEntryDTO
  now: number
  pending: boolean
  onRecall: () => void
  onDone: () => void
  onCancel: () => void
}) {
  const mins = minutesSince(entry.startedAt ?? entry.joinedAt, now)
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] flex flex-col p-5 gap-3">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-accent-600 animate-pulse" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Now Calling</span>
        <span className="ms-auto"><ElapsedPill mins={mins} /></span>
      </div>

      <div>
        <p className="font-mono font-black tabular-nums text-slate-900 leading-[0.85] text-[clamp(2.75rem,11vh,5rem)]" dir="ltr">
          {entry.billNumber ? `#${entry.billNumber}` : 'No bill #'}
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Queue <span className="font-bold text-slate-700 tabular-nums">#{entry.queueNumber}</span>
          {(entry.callCount ?? 0) > 1 && <span className="text-slate-400"> · Called {entry.callCount}×</span>}
        </p>
      </div>

      <div className="space-y-2.5">
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
          onClick={onDone}
          className="w-full h-14 rounded-2xl bg-accent-600 text-white text-base font-bold flex items-center justify-center gap-2 select-none transition-all duration-[250ms] ease-out active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)] active:bg-accent-700"
        >
          <CheckCircle2 className="size-5" />
          Done
        </button>
      </div>
    </div>
  )
}
