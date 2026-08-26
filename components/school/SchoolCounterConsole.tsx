'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  MonitorCheck, Delete, PhoneCall, BellRing, CheckCircle2, PauseCircle, ArrowRightLeft,
} from 'lucide-react'
import {
  ConsoleFrame, ConsoleLoading, TaskSplit, KeypadKey, ElapsedPill,
  ConfirmCancel, useNow, minutesSince,
} from '@/components/counter/console'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  schoolCallNextAction, schoolCallCodeAction, schoolRecallAction,
  schoolDoneAction, schoolNoShowAction, schoolHoldAction, schoolTransferAction,
  schoolCounterHeartbeatAction, schoolToggleCounterOpenAction,
} from '@/lib/actions/school-tokens'
import { fetchSchoolCounterViewAction, type SchoolCounterView } from '@/lib/actions/school-read'

const MAX_CODE_LENGTH = 8
const POLL_MS = 5000
const HEARTBEAT_MS = 20000

/*
 * The calling station — the brochure's "software keypad", running on any
 * operator PC. Type a token and Call, or just press Next and let the system
 * pick. The same page is the receiver for a USB calling keypad, which the OS
 * presents as a keyboard (see the keydown handler below).
 */
export function SchoolCounterConsole({ counterToken, initial }: {
  counterToken: string
  initial: SchoolCounterView
}) {
  const [view, setView] = useState(initial)
  const [code, setCode] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const now = useNow()

  const refresh = useCallback(async () => {
    const next = await fetchSchoolCounterViewAction(counterToken)
    if (next.status === 'ok') setView(next)
  }, [counterToken])

  // These tables are service-role-only, so the console can't subscribe to
  // postgres_changes with the publishable key — it polls instead. Five seconds
  // is well inside the time it takes to serve one visitor.
  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    schoolCounterHeartbeatAction(counterToken)
    const id = setInterval(() => schoolCounterHeartbeatAction(counterToken), HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [counterToken])

  const current = view.current
  const waiting = view.waiting ?? []
  const departments = view.departments ?? []
  const deptById = new Map(departments.map((d) => [d.id, d]))

  const run = useCallback((
    fn: () => Promise<{ error?: string }>,
    success?: (r: { error?: string }) => string | null
  ) => {
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast.error(result.error)
      else {
        const message = success?.(result)
        if (message) toast.success(message)
      }
      await refresh()
    })
  }, [refresh])

  const callNext = useCallback(() => {
    run(
      () => schoolCallNextAction(counterToken),
      (r) => `Calling ${(r as { token?: { tokenCode: string } }).token?.tokenCode ?? ''}`
    )
  }, [counterToken, run])

  const callTyped = useCallback(() => {
    const value = code.trim()
    if (!value) return
    run(() => schoolCallCodeAction(counterToken, value), () => `Calling ${value.toUpperCase()}`)
    setCode('')
  }, [code, counterToken, run])

  const recall = useCallback(() => {
    run(() => schoolRecallAction(counterToken), () => 'Called again')
  }, [counterToken, run])

  const markDone = useCallback(() => {
    run(() => schoolDoneAction(counterToken), () => 'Marked served')
  }, [counterToken, run])

  const markNoShow = useCallback(() => {
    run(() => schoolNoShowAction(counterToken), () => 'Marked no-show')
  }, [counterToken, run])

  const hold = useCallback(() => {
    run(() => schoolHoldAction(counterToken), () => 'Put on hold')
  }, [counterToken, run])

  /*
   * Hardware calling keypad. A USB keypad enumerates as a plain keyboard, so
   * no driver or endpoint is needed — the keystrokes land here. Two things
   * this has to get right:
   *   - the on-screen display field is focusable (inputMode="none" hides the
   *     OS keyboard but doesn't stop focus), so events from an input are
   *     ignored to avoid double-entry;
   *   - keys are read as a stream, not per-keystroke state, so a keypad that
   *     sends its digits in a burst behaves the same as a person typing.
   */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setCode((prev) => (prev + e.key).slice(0, MAX_CODE_LENGTH))
        return
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        setCode((prev) => (prev + e.key.toUpperCase()).slice(0, MAX_CODE_LENGTH))
        return
      }
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          // Enter with nothing typed is the natural "just give me the next
          // one" gesture, and matches how the physical NEXT key behaves.
          if (code.trim()) callTyped()
          else callNext()
          break
        case 'Backspace':
          e.preventDefault()
          setCode((prev) => prev.slice(0, -1))
          break
        case 'Escape':
          e.preventDefault()
          setCode('')
          break
        case '+':
          e.preventDefault()
          callNext()
          break
        case '-':
          e.preventDefault()
          markNoShow()
          break
        case '*':
          e.preventDefault()
          recall()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [code, callTyped, callNext, markNoShow, recall])

  if (view.status !== 'ok') return <ConsoleLoading icon={MonitorCheck} />

  return (
    <ConsoleFrame
      icon={MonitorCheck}
      name={view.counterName ?? 'Counter'}
      typeLabel="Calling Station"
      headerRight={
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          {view.isOpen ? 'Open' : 'Closed'}
          <Switch
            checked={!!view.isOpen}
            disabled={pending}
            onCheckedChange={() => {
              startTransition(async () => {
                const r = await schoolToggleCounterOpenAction(counterToken)
                if (r.error) toast.error(r.error)
                else {
                  setView((prev) => ({ ...prev, isOpen: r.isOpen }))
                  toast.success(r.isOpen ? 'Counter open' : 'Counter closed')
                }
              })
            }}
          />
        </label>
      }
      banner={
        departments.length === 0 ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm font-medium text-amber-800">
            No departments are assigned to this counter yet, so Next has nothing to call.
          </div>
        ) : undefined
      }
    >
      <TaskSplit
        task={
          <div className="flex h-full flex-col gap-3">
            {/* Current token */}
            <div
              className={
                current
                  ? 'shrink-0 rounded-2xl border border-accent-200 bg-accent-50 p-4'
                  : 'shrink-0 rounded-2xl border border-slate-200 bg-white p-4'
              }
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Now serving
                  </p>
                  <p
                    dir="ltr"
                    className="font-mono text-5xl font-black tabular-nums leading-none text-slate-800"
                  >
                    {current?.tokenCode ?? '—'}
                  </p>
                  {current && (
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {deptById.get(current.departmentId)?.nameEn ?? ''}
                      {current.isPriority && ' · Priority'}
                      {current.recallCount > 0 && ` · Called again ×${current.recallCount}`}
                    </p>
                  )}
                </div>
                {current?.calledAt && (
                  <ElapsedPill mins={minutesSince(current.calledAt, now)} />
                )}
              </div>

              {current && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={markDone}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent-600 text-sm font-bold text-white shadow-sm transition active:translate-y-px disabled:opacity-40"
                  >
                    <CheckCircle2 className="size-4.5" />
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={recall}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition active:translate-y-px active:bg-slate-50 disabled:opacity-40"
                  >
                    <BellRing className="size-4.5" />
                    Call Again
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={hold}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition active:translate-y-px active:bg-slate-50 disabled:opacity-40"
                  >
                    <PauseCircle className="size-4.5" />
                    Hold
                  </button>
                  <ConfirmCancel onConfirm={markNoShow} disabled={pending} label="No Show" />
                  {departments.length > 1 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setTransferOpen(true)}
                      className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition active:translate-y-px active:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowRightLeft className="size-4.5" />
                      Send to another department
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Keypad — design system v5 §5.4. Pinned LTR: 1-2-3 / 4-5-6 is a
                physical convention that does not mirror. */}
            <div dir="ltr" className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="shrink-0 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-600/10">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, MAX_CODE_LENGTH))}
                  inputMode="none"
                  placeholder="Token no."
                  aria-label="Token number"
                  className="w-full bg-transparent text-center font-mono text-3xl font-black tabular-nums text-slate-800 outline-none placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:text-slate-400"
                />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
                <div className="col-span-3 grid min-h-0 grid-cols-3 grid-rows-4 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <KeypadKey key={d} onTap={() => setCode((p) => (p + d).slice(0, MAX_CODE_LENGTH))}>
                      {d}
                    </KeypadKey>
                  ))}
                  <KeypadKey variant="danger" onTap={() => setCode('')}>
                    Clear
                  </KeypadKey>
                  <KeypadKey onTap={() => setCode((p) => (p + '0').slice(0, MAX_CODE_LENGTH))}>
                    0
                  </KeypadKey>
                  <KeypadKey variant="muted" onTap={() => setCode((p) => p.slice(0, -1))}>
                    <Delete className="size-6" />
                  </KeypadKey>
                </div>

                <div className="grid min-h-0 grid-rows-2 gap-2">
                  <button
                    type="button"
                    disabled={pending || !code.trim()}
                    onClick={callTyped}
                    className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-700 text-base font-bold text-white shadow-sm transition active:translate-y-px active:bg-slate-800 disabled:opacity-40"
                  >
                    <PhoneCall className="size-5" />
                    Call
                  </button>
                  <button
                    type="button"
                    disabled={pending || departments.length === 0}
                    onClick={callNext}
                    className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-2xl bg-accent-600 text-base font-bold text-white shadow-sm transition active:translate-y-px active:bg-accent-700 disabled:opacity-40"
                  >
                    <BellRing className="size-5" />
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
        list={
          <>
            <div className="mb-2 flex shrink-0 items-baseline gap-2 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Waiting
              </p>
              <p className="text-xs font-semibold tabular-nums text-slate-500">{waiting.length}</p>
              <p className="ms-auto text-xs text-slate-400">
                <span className="tabular-nums">{view.servedToday ?? 0}</span> served today
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pe-1">
              {waiting.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60">
                  <p className="text-sm text-slate-400">Nobody is waiting</p>
                </div>
              ) : (
                waiting.map((token) => {
                  const dept = deptById.get(token.departmentId)
                  return (
                    <div
                      key={token.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm"
                    >
                      <span
                        dir="ltr"
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black tabular-nums text-white"
                        style={{ backgroundColor: dept?.color ?? '#475569' }}
                      >
                        {token.tokenCode}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {dept?.nameEn ?? 'Department'}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {token.isPriority && 'Priority · '}
                          {token.status === 'held' ? 'On hold' : 'Waiting'}
                        </p>
                      </div>
                      <ElapsedPill mins={minutesSince(token.joinedAt, now)} />
                    </div>
                  )
                })
              )}
            </div>
          </>
        }
      />

      <TransferDialog
        open={transferOpen}
        departments={departments.filter((d) => d.id !== current?.departmentId)}
        pending={pending}
        onClose={() => setTransferOpen(false)}
        onPick={(departmentId) => {
          setTransferOpen(false)
          run(() => schoolTransferAction(counterToken, departmentId), () => 'Sent to the other department')
        }}
      />
    </ConsoleFrame>
  )
}

function TransferDialog({ open, departments, pending, onClose, onPick }: {
  open: boolean
  departments: { id: string; nameEn: string; prefix: string; color: string }[]
  pending: boolean
  onClose: () => void
  onPick: (departmentId: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to another department</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The visitor keeps the same token number and rejoins the queue for the department you
          pick.
        </p>
        <div className="space-y-1.5">
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(d.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-start active:bg-slate-50 disabled:opacity-40"
            >
              <span
                dir="ltr"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                style={{ backgroundColor: d.color }}
              >
                {d.prefix}
              </span>
              <span className="flex-1 truncate text-sm font-medium text-slate-800">{d.nameEn}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
