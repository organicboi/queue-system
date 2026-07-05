'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/*
 * "Operator Console" (v3) — shared kit for counter terminals.
 * Light, flat, high-contrast: slate canvas, white cards, solid action
 * colors (green = go, navy = key, red = destructive), mono numbers,
 * exactly one color-matched shadow per surface.
 * See userGuide/design-system-v3.md; extracted from OrderCounter.tsx
 * when Kitchen became the second v3 route.
 */

/* Semantic status pills — 5-state model, flat skin. One accent bucket for
   every "in progress / done" state (design-system v5, §2.5) — no second
   hardcoded green, no orange; No-show shares the neutral Cancelled skin. */
export const STATUS_PILL: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'in-progress': { label: 'Serving', className: 'bg-accent-50 text-accent-700 border border-accent-200' },
  completed: { label: 'Done', className: 'bg-accent-50 text-accent-700 border border-accent-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  'no-show': { label: 'No-show', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

/*
 * Full-screen frame: flat slate canvas, flat white header (solid icon
 * tile + name + caps type line + live clock). Never scrolls — only
 * inner lists scroll.
 */
export function ConsoleFrame({ icon: Icon, name, typeLabel, banner, headerRight, children }: {
  icon: LucideIcon
  name: string
  typeLabel: string
  banner?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative isolate h-dvh overflow-hidden overscroll-none flex flex-col select-none touch-manipulation bg-slate-100 text-slate-800">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 min-h-16 pt-[env(safe-area-inset-top)] flex items-center gap-3.5">
        <div className="size-10 rounded-xl bg-accent-600 flex items-center justify-center shrink-0 shadow-[0_3px_10px_-4px_rgba(5,150,105,0.55)]">
          <Icon className="size-5 text-white" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1 className="text-[15px] font-bold text-slate-800 truncate">{name}</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{typeLabel}</p>
        </div>
        <div className="ms-auto flex items-center gap-3.5 shrink-0">
          {headerRight}
          {headerRight && <div className="h-8 w-px bg-slate-200" />}
          <HeaderClock />
        </div>
      </header>
      {banner}
      <div className="relative flex-1 min-h-0">{children}</div>
    </div>
  )
}

/* Live date + time, mount-guarded to avoid hydration mismatch. */
export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ms-auto text-end leading-tight shrink-0 min-w-24">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ' '}
      </p>
      <p className="text-sm font-bold text-slate-700 tabular-nums">
        {now ? now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ' '}
      </p>
    </div>
  )
}

export function ConsoleLoading({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2.5 text-slate-400">
      <Icon className="size-9 animate-pulse" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}

/*
 * Two-panel task layout (design system v5, §5.2): task panel beside list
 * panel. Landscape: task ~1.3fr at the inline-start, list 1fr. Portrait:
 * task ~1.55fr on top, list fills the rest. Generalizes to any "one thing
 * being acted on, plus a queue" screen (Order, Billing, Delivery).
 */
export function TaskSplit({ task, list }: { task: ReactNode; list: ReactNode }) {
  return (
    <div className="h-full grid gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] portrait:grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] landscape:grid-rows-1 landscape:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="min-h-0">{task}</section>
      <section className="min-h-0 flex flex-col">{list}</section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Time helpers (design system v5, §4)                                 */
/* ------------------------------------------------------------------ */

/* Re-render tick so elapsed-time badges stay honest. */
export function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

/* Elapsed time is a decision aid, not a stopwatch: quiet -> amber (8min)
   -> red (15min), then back to quiet "stale" past 4h — red is reserved
   for actionable urgency, not for tickets old enough to be a data-hygiene
   issue. Thresholds are per-station config; the bucket structure is fixed. */
export function bucketElapsed(mins: number, opts?: { warnAfterMin?: number; alertAfterMin?: number; staleAfterMin?: number }) {
  const { warnAfterMin = 8, alertAfterMin = 15, staleAfterMin = 240 } = opts ?? {}
  const stale = mins > staleAfterMin
  const skin =
    stale ? 'bg-slate-100 text-slate-400 border-slate-200' :
    mins >= alertAfterMin ? 'bg-red-50 text-red-600 border-red-200' :
    mins >= warnAfterMin ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-slate-100 text-slate-500 border-slate-200'
  return { stale, skin }
}

/* Human buckets: under 60min -> "N min", 1-24h -> "Hh MMm", over 24h -> "Nd".
   Never render a raw minute count >= 60. */
export function formatElapsed(mins: number, stale: boolean) {
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return stale ? `${hours}h` : `${hours}h ${String(mins % 60).padStart(2, '0')}m`
  return `${Math.floor(hours / 24)}d`
}

export function ElapsedPill({ mins, ...opts }: {
  mins: number
  warnAfterMin?: number
  alertAfterMin?: number
  staleAfterMin?: number
}) {
  const { stale, skin } = bucketElapsed(mins, opts)
  return (
    <span className={`inline-flex items-center h-7 rounded-full border px-2.5 text-xs font-bold tabular-nums whitespace-nowrap shrink-0 gap-1 ${skin}`}>
      <span dir="ltr">{formatElapsed(mins, stale)}</span>
      {stale && 'stale'}
    </span>
  )
}

/* Every key — digits, 0, backspace, Clear — shares one neutral skin
   (design-system v5, §2.1): color signals nothing here, only the label
   does. `variant` now only adjusts typography for what the key holds. */
export function KeypadKey({ children, onTap, disabled, variant = 'digit', className = '', ...rest }: {
  children: ReactNode
  onTap: () => void
  disabled?: boolean
  variant?: 'digit' | 'muted' | 'danger'
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const typeClass = {
    digit: 'text-3xl font-bold',
    muted: '',
    danger: 'text-base font-bold',
  }[variant]
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`h-full min-h-0 rounded-2xl select-none transition active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 flex items-center justify-center bg-slate-700 text-white shadow-[0_4px_10px_-4px_rgba(15,23,42,0.35)] active:bg-slate-800 ${typeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/*
 * Mis-tap guard for destructive actions: first tap arms (3s window,
 * auto-disarms), second tap fires. Shared by RowCancel (list rows) and
 * ConfirmCancel (hero action bars) — same guard, different chrome.
 */
export function useTapGuard(onConfirm: () => void, ms = 3000) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function tap() {
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), ms)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setArmed(false)
    onConfirm()
  }

  return { armed, tap }
}

/* Labeled two-tap cancel — no icon-only guessing, mis-tap guarded. For
   inline list rows (Order's Recent Orders). */
export function RowCancel({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const { armed, tap } = useTapGuard(onConfirm)
  return (
    <button
      type="button"
      onClick={tap}
      disabled={disabled}
      className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 select-none transition active:scale-95 disabled:opacity-40 ${
        armed ? 'bg-red-500 text-white shadow-sm' : 'bg-white border border-red-200 text-red-600 shadow-sm active:bg-red-50'
      }`}
    >
      {armed ? 'Confirm' : <><XCircle className="size-3.5" /> Cancel</>}
    </button>
  )
}

/* Same guard, sized for a hero action bar (Billing/Delivery's focus card). */
export function ConfirmCancel({ onConfirm, disabled, label = 'Cancel' }: {
  onConfirm: () => void
  disabled?: boolean
  label?: string
}) {
  const { armed, tap } = useTapGuard(onConfirm)
  return (
    <button
      type="button"
      onClick={tap}
      disabled={disabled}
      className={`h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 select-none transition-all duration-[250ms] ease-out active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0 ${
        armed ? 'bg-red-500 text-white shadow-sm' : 'bg-white border border-red-200 text-red-600 shadow-sm active:bg-red-50'
      }`}
    >
      {armed ? 'Tap to confirm' : <><XCircle className="size-4.5" /> {label}</>}
    </button>
  )
}
