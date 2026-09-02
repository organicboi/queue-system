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

// Same three tiers the ticket's big number and its cadence read off —
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

// Formats a fixed date string ("02 SEP 2026") for the ticket stub. Purely a
// transform of the given string — never reads the wall clock — so it stays
// safe to call during render.
function formatStubDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
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
    <div className="min-h-dvh bg-[#f3f6f1] bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(20,83,45,0.07),transparent_60%)] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Header logoUrl={status.logoUrl} schoolName={schoolName} schoolNameAr={status.schoolNameAr} bilingual={bilingual} />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${status.status}-${status.tokenStatus}-${status.isToday}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Body
                status={status}
                bilingual={bilingual}
                justCalled={justCalled}
                connected={connected}
                isFetching={isFetching}
                agoLabel={agoLabel}
                onRefresh={() => manualRefreshRef.current?.()}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
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
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-14 rounded-2xl border border-[#e7e0cd] bg-white object-contain p-1.5 shadow-sm"
        />
      ) : (
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#14532d] text-[15px] font-extrabold text-[#fdfaf3]">
          {schoolName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-[#14532d]">{schoolName}</p>
        {bilingual && schoolNameAr && (
          <p className="text-[13px] text-[#78877d]" dir="rtl">{schoolNameAr}</p>
        )}
      </div>
    </div>
  )
}

// The shared "boarding pass" shape: a light ivory stub, a perforated tear,
// then a white body. `stub` carries its own background/padding classes so
// the called state can flip it dark without this shell knowing about tone.
function TicketShell({ stub, children }: { stub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-visible rounded-[22px] shadow-[0_20px_44px_-18px_rgba(20,83,45,0.28)]">
      {stub}
      <Perforation />
      <div className="rounded-b-[22px] bg-white px-6 pt-[22px] pb-6">{children}</div>
    </div>
  )
}

function Perforation() {
  return (
    <div className="relative h-px bg-[repeating-linear-gradient(90deg,#d9e2d3_0_8px,transparent_8px_16px)]">
      <div className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-[#f3f6f1]" />
      <div className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-[#f3f6f1]" />
    </div>
  )
}

// The "Updated Xs ago" + manual refresh row, only ever shown on a ticket
// that's actually still polling (waiting/held or called) — everything
// terminal has nothing left to refresh.
function LiveRow({ connected, isFetching, agoLabel, onRefresh }: {
  connected: boolean
  isFetching: boolean
  agoLabel: string
  onRefresh: () => void
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3f6b4a]">
        <span className="relative flex size-1.5">
          {connected && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#166534] opacity-60" />
          )}
          <span
            className={
              'relative inline-flex size-1.5 rounded-full ' +
              (connected ? 'bg-[#166534]' : 'bg-amber-500')
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
        className="flex size-6 items-center justify-center rounded-full text-[#3f6b4a] transition-colors hover:bg-[#eef3ea] active:scale-95 disabled:opacity-60"
      >
        <RefreshCw className={'size-3.5' + (isFetching ? ' animate-spin' : '')} />
      </button>
    </div>
  )
}

// The decorative barcode + ticket-id footer line from the mockup. Purely a
// ticket-authenticity flourish (the bar heights encode nothing) — cheap to
// keep, cheap to cut if it ever needs to go.
function BarcodeFooter({ tokenCode }: { tokenCode: string }) {
  const heights = [100, 60, 90, 40, 100, 70, 50, 85, 100, 55, 75, 45, 95, 60, 100, 35, 80, 50]
  return (
    <div className="mt-5 border-t border-dashed border-[#d9e2d3] pt-4">
      <div className="flex h-7 items-end gap-[2px] opacity-70">
        {heights.map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%` }}
            className={(i % 3 === 0 ? 'w-[3px]' : i % 2 === 0 ? 'w-[2px]' : 'w-px') + ' bg-[#14532d]'}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-[#a8a29e]">
        TICKET {tokenCode} · LIVE
      </p>
    </div>
  )
}

// Flat notice card for states with no active pass to show (unknown code,
// tracking off, previous-day, or a closed-out ticket) — same palette as the
// boarding pass, just without the stub/perforation/barcode machinery.
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-[22px] border border-[#e7e0cd] bg-white p-6 text-center shadow-[0_16px_40px_-18px_rgba(20,83,45,0.2)]">
      {children}
    </div>
  )
}

function Body({ status, bilingual, justCalled, connected, isFetching, agoLabel, onRefresh }: {
  status: PublicTicketStatus
  bilingual: boolean
  justCalled: boolean
  connected: boolean
  isFetching: boolean
  agoLabel: string
  onRefresh: () => void
}) {
  if (status.status === 'not-found') {
    return (
      <InfoCard>
        <XCircle className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">We couldn&apos;t find this ticket</p>
        <p className="text-sm text-[#78716c]">
          The link may be mistyped, or the ticket is no longer available.
        </p>
        {bilingual && (
          <p className="text-sm text-[#78716c]" dir="rtl">
            تعذّر العثور على هذه التذكرة. قد يكون الرابط غير صحيح.
          </p>
        )}
      </InfoCard>
    )
  }

  if (status.status === 'disabled' || status.status === 'expired') {
    return (
      <InfoCard>
        <Clock3 className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">Live tracking isn&apos;t available</p>
        <p className="text-sm text-[#78716c]">
          Please watch the screen in the waiting area for your number.
        </p>
        {bilingual && (
          <p className="text-sm text-[#78716c]" dir="rtl">
            التتبع المباشر غير متاح حاليًا. يرجى متابعة الشاشة في منطقة الانتظار.
          </p>
        )}
      </InfoCard>
    )
  }

  // status === 'ok' from here on
  const dept = status.departmentNameEn ?? ''
  const deptAr = status.departmentNameAr ?? ''
  const dateLabel = formatStubDate(status.serviceDate)

  if (status.isToday === false && (status.tokenStatus === 'waiting' || status.tokenStatus === 'held')) {
    return (
      <InfoCard>
        <Clock3 className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">This ticket was for a previous day</p>
        <p className="text-sm text-[#78716c]">
          Token {status.tokenCode} is no longer being tracked. Please take a new ticket if you still need one.
        </p>
        {bilingual && (
          <p className="text-sm text-[#78716c]" dir="rtl">
            هذه التذكرة كانت ليوم سابق ولم تعد قيد التتبع. يرجى أخذ تذكرة جديدة إذا كنت لا تزال بحاجة إليها.
          </p>
        )}
      </InfoCard>
    )
  }

  if (status.tokenStatus === 'served') {
    return (
      <InfoCard>
        <CheckCircle2 className="mx-auto size-9 text-[#166534]" strokeWidth={1.5} />
        <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-[#14532d]" dir="ltr">
          {status.tokenCode}
        </p>
        <p className="text-base font-semibold text-[#166534]">You&apos;ve been served — thank you</p>
        {bilingual && <p className="text-sm text-[#78716c]" dir="rtl">تم إنهاء خدمتك، شكرًا لك</p>}
      </InfoCard>
    )
  }

  if (status.tokenStatus === 'no-show' || status.tokenStatus === 'cancelled') {
    return (
      <InfoCard>
        <XCircle className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-[#292524]" dir="ltr">
          {status.tokenCode}
        </p>
        <p className="text-base font-semibold text-[#57534e]">
          {status.tokenStatus === 'no-show' ? 'This ticket was marked as missed' : 'This ticket was cancelled'}
        </p>
        {bilingual && (
          <p className="text-sm text-[#78716c]" dir="rtl">
            {status.tokenStatus === 'no-show' ? 'تم تسجيل هذه التذكرة كغياب' : 'تم إلغاء هذه التذكرة'}
          </p>
        )}
      </InfoCard>
    )
  }

  if (status.tokenStatus === 'called') {
    return (
      <TicketShell
        stub={
          <div className="rounded-t-[22px] bg-[#14532d] px-6 pt-[22px] pb-[26px]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bfe0cb]">It&apos;s your turn</p>
              <p className="text-[11px] font-medium text-[#5f8a6d]">{dateLabel}</p>
            </div>
            <p className="mt-3.5 text-xs text-[#9fc2ab]">{dept}</p>
            {bilingual && deptAr && (
              <p className="mt-0.5 text-[11px] text-[#5f8a6d]" dir="rtl">{deptAr}</p>
            )}
            <p className="mt-2.5 font-mono text-[52px] font-black leading-none tracking-tight text-white" dir="ltr">
              {status.tokenCode}
            </p>
          </div>
        }
      >
        <LiveRow connected={connected} isFetching={isFetching} agoLabel={agoLabel} onRefresh={onRefresh} />
        <motion.div
          initial={justCalled ? { scale: 0.9, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e6f4ea]">
            <PartyPopper className="size-6 text-[#14532d]" strokeWidth={1.75} />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-lg font-bold text-[#14532d]">
            <MapPin className="size-5" />
            Go to {status.counterNameEn || 'the counter'}
          </p>
          {bilingual && (
            <p className="mt-1 text-sm font-semibold text-[#3f6b4a]" dir="rtl">
              توجه إلى {status.counterNameAr || 'الكاونتر'}
            </p>
          )}
        </motion.div>
        <BarcodeFooter tokenCode={status.tokenCode ?? ''} />
      </TicketShell>
    )
  }

  // waiting / held, today
  const ahead = status.waitingAhead ?? 0
  const line = aheadLine(ahead)
  const eta = ahead > 0 && status.etaSeconds ? etaRange(status.etaSeconds) : null
  const proximity = proximityOf(status)

  return (
    <TicketShell
      stub={
        <div className="rounded-t-[22px] border-b border-[#e7e0cd] bg-[#fdfaf3] px-6 pt-[22px] pb-[26px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#166534]">Queue Pass</p>
            <p className="text-[11px] font-medium text-[#a8a29e]">{dateLabel}</p>
          </div>
          <p className="mt-3.5 text-xs text-[#57534e]">{dept}</p>
          {bilingual && deptAr && (
            <p className="mt-0.5 text-[11px] text-[#a8a29e]" dir="rtl">{deptAr}</p>
          )}
          <p className="mt-2.5 font-mono text-[52px] font-black leading-none tracking-tight text-[#14532d]" dir="ltr">
            {status.tokenCode}
          </p>
        </div>
      }
    >
      <LiveRow connected={connected} isFetching={isFetching} agoLabel={agoLabel} onRefresh={onRefresh} />

      <div
        className={
          'inline-flex items-baseline gap-2.5 rounded-2xl' +
          (proximity === 'next' ? ' bg-[#e6f4ea] px-3 py-1.5 -mx-1' : '')
        }
      >
        <motion.p
          key={ahead}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[44px] font-black leading-none tracking-tight tabular-nums text-[#14532d]"
        >
          {String(ahead).padStart(2, '0')}
        </motion.p>
        <p className="text-sm font-medium leading-tight text-[#57534e]">
          {ahead > 0 ? <>people waiting<br />before you</> : <>you&apos;re<br />next</>}
        </p>
      </div>

      {ahead > 0 && (
        <p className="mt-1.5 text-xs text-[#78716c]" dir="rtl">
          {line.ar}
        </p>
      )}

      {(eta || status.nowServingCode) && (
        <div
          className={
            'mt-5 grid gap-3 border-t border-dashed border-[#d9e2d3] pt-4 text-left ' +
            (eta && status.nowServingCode ? 'grid-cols-2' : 'grid-cols-1')
          }
        >
          {eta && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a8a29e]">Est. wait</p>
              <p className="mt-0.5 text-[15px] font-bold text-[#1c2e22]">{eta.en}</p>
            </div>
          )}
          {status.nowServingCode && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a8a29e]">Now serving</p>
              <p className="mt-0.5 font-mono text-[15px] font-bold text-[#1c2e22]">{status.nowServingCode}</p>
            </div>
          )}
        </div>
      )}

      <BarcodeFooter tokenCode={status.tokenCode ?? ''} />
    </TicketShell>
  )
}
