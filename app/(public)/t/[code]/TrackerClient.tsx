'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, PartyPopper, CheckCircle2, XCircle, Clock3, MapPin } from 'lucide-react'
import type { PublicTicketStatus } from '@/lib/db/school-types'

interface Props {
  code: string
  initial: PublicTicketStatus
}

// ── Polling policy ──────────────────────────────────────────────
// Live position without a websocket-per-visitor: the school_* tables are
// service-role-only under RLS and not in the supabase_realtime publication
// (see the schema's own comments on that), and a socket per open lobby tab
// would hit Supabase's connection cap for what this page actually needs.
// Adaptive polling gets the same felt responsiveness for a fraction of the
// traffic:
//   1. Paused entirely while the tab is hidden (the dominant case — a phone
//      in a pocket) and refetched immediately on refocus.
//   2. Cadence scales with how close the visitor is — nobody 40 back needs
//      5-second updates, but someone about to be called does.
//   3. Stopped for good on a terminal status or a stale previous-day ticket.
//   4. Backs off on error rather than hammering a route that's failing.
//   5. Hard stop after 4 hours so an abandoned tab costs nothing forever.
//   6. The visitor can always force one with the refresh button regardless
//      of where the schedule is — that's what it's there for.
const HARD_STOP_MS = 4 * 60 * 60 * 1000

// Same three tiers the ring's colour and the caption below it read off —
// nobody 40 back needs to feel "urgent", someone about to be called does.
type Proximity = 'far' | 'near' | 'next'

function proximityOf(status: PublicTicketStatus): Proximity {
  if (status.tokenStatus === 'called') return 'next'
  const ahead = status.waitingAhead ?? 99
  if (ahead <= 3) return 'next'
  if (ahead <= 10) return 'near'
  return 'far'
}

function pollDelayMs(status: PublicTicketStatus): number {
  if (status.tokenStatus === 'called') return 5000
  const p = proximityOf(status)
  if (p === 'next') return 5000
  if (p === 'near') return 15000
  return 30000
}

function isTerminal(status: PublicTicketStatus): boolean {
  return (
    status.status !== 'ok' ||
    status.tokenStatus === 'served' ||
    status.tokenStatus === 'no-show' ||
    status.tokenStatus === 'cancelled' ||
    status.isToday === false
  )
}

// Same wording contract as waitingAheadLine() in lib/school/printTicket.ts
// and mobile/kiosk/lib/src/printing/ticket_widget.dart — kept independent
// here (this page must not pull the print pipeline into its bundle) but
// intentionally worded the same so the ticket and the page never disagree.
function aheadLine(count: number): { en: string; ar: string } {
  if (count <= 0) return { en: 'You are next in line', ar: 'أنت التالي في الطابور' }
  return {
    en: count === 1 ? '1 person waiting before you' : `${count} people waiting before you`,
    ar: `عدد المنتظرين قبلك: ${count}`,
  }
}

// A precise-looking single number on a queue is a promise the system can't
// keep, so this is always a 5-minute-rounded range (−20% / +30% of the
// throughput estimate), and it's the caller's job to withhold it entirely
// when nobody is ahead.
function etaRange(etaSeconds: number): { en: string; ar: string } {
  const round5 = (mins: number) => Math.max(5, Math.round(mins / 5) * 5)
  const lo = round5((etaSeconds * 0.8) / 60)
  const hi = Math.max(lo + 5, round5((etaSeconds * 1.3) / 60))
  return { en: `~${lo}–${hi} min`, ar: `~${lo}–${hi} دقيقة` }
}

function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 8) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

export function TrackerClient({ code, initial }: Props) {
  const [status, setStatus] = useState<PublicTicketStatus>(initial)
  const [connected, setConnected] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [justCalled, setJustCalled] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now())
  const [agoLabel, setAgoLabel] = useState('just now')

  // A stable handle the refresh button can call into the polling effect
  // below with — assigned inside that effect (never during render), which
  // is what keeps this a plain imperative escape hatch rather than a value
  // the render body depends on.
  const manualRefreshRef = useRef<(() => void) | null>(null)

  // All the polling state and logic lives inside this one effect, as plain
  // local closures rather than memoized callbacks/refs read during render —
  // it is pure side-effecting machinery with nothing the render body needs
  // except the state setters it calls.
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let errorStreak = 0
    let current = initial
    const startedAt = Date.now()

    function clearTimer() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    async function fetchOnce() {
      setIsFetching(true)
      try {
        const res = await fetch(`/api/public/ticket/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as PublicTicketStatus
        if (cancelled) return

        errorStreak = 0
        setConnected(true)
        setLastUpdatedAt(Date.now())

        if (data.tokenStatus === 'called' && current.tokenStatus !== 'called') {
          setJustCalled(true)
          if (typeof navigator !== 'undefined') {
            navigator.vibrate?.([200, 100, 200])
          }
        }
        current = data
        setStatus(data)
      } catch {
        if (cancelled) return
        errorStreak = Math.min(errorStreak + 1, 6)
        setConnected(false)
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }

    function schedule() {
      clearTimer()
      if (cancelled) return
      if (Date.now() - startedAt > HARD_STOP_MS) return
      if (typeof document !== 'undefined' && document.hidden) return
      if (isTerminal(current) && errorStreak === 0) return

      const base = pollDelayMs(current)
      // Backoff on error: 5s → 10 → 20 → 40 → 60, capped.
      const delay = errorStreak > 0
        ? Math.min(60000, 5000 * 2 ** errorStreak)
        : base

      timeoutId = setTimeout(async () => {
        await fetchOnce()
        schedule()
      }, delay)
    }

    function onVisibility() {
      if (document.hidden) {
        clearTimer()
        return
      }
      // Back in view: refetch immediately, then resume the normal cadence —
      // this is what makes the page feel instant when someone actually looks.
      clearTimer()
      fetchOnce().then(() => schedule())
    }

    manualRefreshRef.current = () => {
      clearTimer()
      fetchOnce().then(() => schedule())
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [code, initial])

  // The "Xs/Xm ago" label — recomputed here (never read as Date.now() minus
  // a stored timestamp during render, which the purity rule for components
  // rejects) and restarted every time lastUpdatedAt actually moves, which is
  // also the semantically right moment to reset the "just now" countdown.
  // Paused on document.hidden the same way the polling effect is.
  useEffect(() => {
    function update() {
      setAgoLabel(formatAgo(Date.now() - lastUpdatedAt))
    }
    update()
    let intervalId: ReturnType<typeof setInterval> | null = null
    function start() {
      if (intervalId !== null) return
      intervalId = setInterval(update, 1000)
    }
    function stop() {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }
    function onVisibility() {
      if (document.hidden) stop()
      else {
        update()
        start()
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [lastUpdatedAt])

  const languages = status.languages ?? ['en']
  const bilingual = languages.includes('ar')
  const schoolName = status.schoolNameEn || 'Queue'

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,theme(colors.emerald.50),theme(colors.slate.50)_55%)] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Header logoUrl={status.logoUrl} schoolName={schoolName} schoolNameAr={status.schoolNameAr} bilingual={bilingual} />

        <TopStatusBar
          connected={connected}
          isFetching={isFetching}
          agoLabel={agoLabel}
          onRefresh={() => manualRefreshRef.current?.()}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={`${status.status}-${status.tokenStatus}-${status.isToday}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Body status={status} bilingual={bilingual} justCalled={justCalled} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function TopStatusBar({ connected, isFetching, agoLabel, onRefresh }: {
  connected: boolean
  isFetching: boolean
  agoLabel: string
  onRefresh: () => void
}) {
  return (
    <div className="mt-5 mb-4 flex items-center justify-between rounded-full border border-slate-200/70 bg-white/70 px-3.5 py-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
        <span className="relative flex size-2">
          {connected && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={
              'relative inline-flex size-2 rounded-full ' +
              (connected ? 'bg-emerald-500' : 'bg-amber-400')
            }
          />
        </span>
        <span>Updated {agoLabel}</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh"
        className="flex size-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95 disabled:opacity-60"
      >
        <RefreshCw className={'size-3.5' + (isFetching ? ' animate-spin' : '')} />
      </button>
    </div>
  )
}

function Header({ logoUrl, schoolName, schoolNameAr, bilingual }: {
  logoUrl?: string
  schoolName: string
  schoolNameAr?: string
  bilingual: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-14 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm"
        />
      )}
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-slate-900">{schoolName}</p>
        {bilingual && schoolNameAr && (
          <p className="text-[13px] text-slate-500" dir="rtl">{schoolNameAr}</p>
        )}
      </div>
    </div>
  )
}

function Card({ children, tone = 'default' }: {
  children: React.ReactNode
  tone?: 'default' | 'accent'
}) {
  return (
    <div
      className={
        'rounded-[28px] p-6 text-center space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(15,23,42,0.18)] ' +
        (tone === 'accent'
          ? 'border border-emerald-200/70 bg-gradient-to-b from-emerald-50 to-white'
          : 'border border-slate-200/70 bg-white')
      }
    >
      {children}
    </div>
  )
}

// A quiet radial gauge behind the "people ahead" number — closes in as the
// visitor's turn approaches. Purely a feeling instrument, not a literal
// fraction of anything (there's no fixed denominator to a queue), so it's
// keyed off the same three-tier proximity everything else here already
// uses rather than inventing its own scale.
function ProximityRing({ proximity, children }: {
  proximity: Proximity
  children: React.ReactNode
}) {
  const size = 168
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const fraction = proximity === 'next' ? 0.92 : proximity === 'near' ? 0.55 : 0.22
  const color =
    proximity === 'next' ? '#10b981' : proximity === 'near' ? '#f59e0b' : '#94a3b8'

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-100"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function Body({ status, bilingual, justCalled }: {
  status: PublicTicketStatus
  bilingual: boolean
  justCalled: boolean
}) {
  if (status.status === 'not-found') {
    return (
      <Card>
        <XCircle className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
        <p className="text-base font-semibold text-slate-800">We couldn&apos;t find this ticket</p>
        <p className="text-sm text-slate-500">
          The link may be mistyped, or the ticket is no longer available.
        </p>
        {bilingual && (
          <p className="text-sm text-slate-500" dir="rtl">
            تعذّر العثور على هذه التذكرة. قد يكون الرابط غير صحيح.
          </p>
        )}
      </Card>
    )
  }

  if (status.status === 'disabled' || status.status === 'expired') {
    return (
      <Card>
        <Clock3 className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
        <p className="text-base font-semibold text-slate-800">Live tracking isn&apos;t available</p>
        <p className="text-sm text-slate-500">
          Please watch the screen in the waiting area for your number.
        </p>
        {bilingual && (
          <p className="text-sm text-slate-500" dir="rtl">
            التتبع المباشر غير متاح حاليًا. يرجى متابعة الشاشة في منطقة الانتظار.
          </p>
        )}
      </Card>
    )
  }

  // status === 'ok' from here on
  const dept = status.departmentNameEn ?? ''
  const deptAr = status.departmentNameAr ?? ''

  if (status.isToday === false && (status.tokenStatus === 'waiting' || status.tokenStatus === 'held')) {
    return (
      <Card>
        <Clock3 className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
        <p className="text-base font-semibold text-slate-800">This ticket was for a previous day</p>
        <p className="text-sm text-slate-500">
          Token {status.tokenCode} is no longer being tracked. Please take a new ticket if you still need one.
        </p>
        {bilingual && (
          <p className="text-sm text-slate-500" dir="rtl">
            هذه التذكرة كانت ليوم سابق ولم تعد قيد التتبع. يرجى أخذ تذكرة جديدة إذا كنت لا تزال بحاجة إليها.
          </p>
        )}
      </Card>
    )
  }

  if (status.tokenStatus === 'served') {
    return (
      <Card tone="accent">
        <CheckCircle2 className="mx-auto size-9 text-emerald-500" strokeWidth={1.5} />
        <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-slate-800" dir="ltr">
          {status.tokenCode}
        </p>
        <p className="text-base font-semibold text-emerald-700">You&apos;ve been served — thank you</p>
        {bilingual && <p className="text-sm text-slate-500" dir="rtl">تم إنهاء خدمتك، شكرًا لك</p>}
      </Card>
    )
  }

  if (status.tokenStatus === 'no-show' || status.tokenStatus === 'cancelled') {
    return (
      <Card>
        <XCircle className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
        <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-slate-800" dir="ltr">
          {status.tokenCode}
        </p>
        <p className="text-base font-semibold text-slate-600">
          {status.tokenStatus === 'no-show' ? 'This ticket was marked as missed' : 'This ticket was cancelled'}
        </p>
        {bilingual && (
          <p className="text-sm text-slate-500" dir="rtl">
            {status.tokenStatus === 'no-show' ? 'تم تسجيل هذه التذكرة كغياب' : 'تم إلغاء هذه التذكرة'}
          </p>
        )}
      </Card>
    )
  }

  if (status.tokenStatus === 'called') {
    return (
      <motion.div
        initial={justCalled ? { scale: 0.96 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative overflow-hidden rounded-[28px] border border-emerald-300/70 bg-gradient-to-b from-emerald-500 to-emerald-600 p-7 text-center shadow-[0_20px_50px_-16px_rgba(16,185,129,0.55)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/15">
            <PartyPopper className="size-7 text-white" strokeWidth={1.75} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-50">
            It&apos;s your turn
          </p>
          <p className="font-mono text-5xl font-black tracking-tight tabular-nums text-white" dir="ltr">
            {status.tokenCode}
          </p>
          <div className="flex items-center justify-center gap-1.5 text-lg font-bold text-white">
            <MapPin className="size-5" />
            Go to {status.counterNameEn || 'the counter'}
          </div>
          {bilingual && (
            <p className="text-base font-semibold text-emerald-50" dir="rtl">
              توجه إلى {status.counterNameAr || 'الكاونتر'}
            </p>
          )}
        </div>
      </motion.div>
    )
  }

  // waiting / held, today
  const ahead = status.waitingAhead ?? 0
  const line = aheadLine(ahead)
  const eta = ahead > 0 && status.etaSeconds ? etaRange(status.etaSeconds) : null
  const proximity = proximityOf(status)

  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your ticket</p>
      <p className="font-mono text-4xl font-black tracking-tight tabular-nums text-slate-900" dir="ltr">
        {status.tokenCode}
      </p>
      <p className="text-sm text-slate-500">
        {dept}{bilingual && deptAr ? ` · ${deptAr}` : ''}
      </p>

      <ProximityRing proximity={proximity}>
        <div className="text-center">
          <motion.p
            key={ahead}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-4xl font-black tabular-nums text-slate-900"
          >
            {ahead}
          </motion.p>
          <p className="text-[11px] font-medium text-slate-400">ahead of you</p>
        </div>
      </ProximityRing>

      <div>
        <p className="text-sm font-semibold text-slate-800">{line.en}</p>
        {bilingual && <p className="text-sm text-slate-500 mt-0.5" dir="rtl">{line.ar}</p>}
      </div>

      {eta && (
        <p className="text-sm text-slate-500">
          Estimated wait <span className="font-semibold text-slate-700">{eta.en}</span>
          {bilingual && <span dir="rtl"> · {eta.ar}</span>}
        </p>
      )}

      {status.nowServingCode && (
        <div className="border-t border-slate-100 pt-3.5">
          <p className="text-xs text-slate-400">
            Now serving{' '}
            <span className="font-mono font-semibold text-slate-600">{status.nowServingCode}</span>
            {' '}in {dept}
          </p>
        </div>
      )}
    </Card>
  )
}
