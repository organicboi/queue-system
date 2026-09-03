'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, PartyPopper, CheckCircle2, XCircle, Clock3, MapPin } from 'lucide-react'
import type { PublicTicketStatus } from '@/lib/db/school-types'
import type { Locale } from '@/lib/region'
import { coerceLocales, dirFor, pickLocale } from '@/lib/region'

interface Props {
  code: string
  initial: PublicTicketStatus
}

// ── Polling policy ──────────────────────────────────────────────
// Live position without a websocket-per-visitor: the school_* tables are
// service-role-only under RLS and not in the supabase_realtime publication
// (see the schema's own comments on that), and a socket per open lobby tab
// would hit Supabase's connection cap for what this page actually needs.
// Kept deliberately light:
//   1. Paused entirely while the tab is hidden (the dominant case — a phone
//      in a pocket) and refetched immediately on refocus.
//   2. A flat 3-minute cadence otherwise — this is a lobby page glanced at
//      occasionally, not a live ticker.
//   3. Stopped for good on a terminal status or a stale previous-day ticket.
//   4. Backs off on error rather than hammering a route that's failing.
//   5. Hard stop after 4 hours so an abandoned tab costs nothing forever.
//   6. The visitor can force one with the refresh button, throttled to once
//      a minute (reusing lastUpdatedAt as the cooldown clock) so it can't be
//      used to bypass the cadence above by spam-tapping.
const HARD_STOP_MS = 4 * 60 * 60 * 1000
const AUTO_POLL_MS = 3 * 60 * 1000
const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000

// Same three tiers the ticket's big ahead-count reads off for its highlight —
// nobody 40 back needs to feel "urgent", someone about to be called does.
type Proximity = 'far' | 'near' | 'next'

function proximityOf(status: PublicTicketStatus): Proximity {
  if (status.tokenStatus === 'called') return 'next'
  const ahead = status.waitingAhead ?? 99
  if (ahead <= 3) return 'next'
  if (ahead <= 10) return 'near'
  return 'far'
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
function aheadLine(count: number): Record<Locale, string> {
  if (count <= 0) {
    return {
      en: 'You are next in line',
      ar: 'أنت التالي في الطابور',
      mr: 'तुमचा नंबर पुढे आहे',
      hi: 'अगली बारी आपकी है',
    }
  }
  return {
    en: count === 1 ? '1 person waiting before you' : `${count} people waiting before you`,
    ar: `عدد المنتظرين قبلك: ${count}`,
    mr: `तुमच्या आधी प्रतीक्षेत असलेले: ${count}`,
    hi: `आपसे पहले प्रतीक्षा में: ${count}`,
  }
}

// UI chrome for the public tracker. Content strings (school / department /
// counter names) come from the RPC and are not translated here.
interface TrackerCopy {
  notFoundTitle: string
  notFoundBody: string
  disabledTitle: string
  disabledBody: string
  prevDayTitle: string
  prevDayBody: string
  served: string
  missed: string
  cancelledMsg: string
  yourTurn: string
  goTo: string
  queuePass: string
  peopleWaiting: string
  youreNext: string
  thankYou: string
}
const COPY: Record<Locale, TrackerCopy> = {
  en: {
    notFoundTitle: "We couldn't find this ticket",
    notFoundBody: 'The link may be mistyped, or the ticket is no longer available.',
    disabledTitle: "Live tracking isn't available",
    disabledBody: 'Please watch the screen in the waiting area for your number.',
    prevDayTitle: 'This ticket was for a previous day',
    prevDayBody: 'This token is no longer being tracked. Please take a new ticket if you still need one.',
    served: "You've been served — thank you",
    missed: 'This ticket was marked as missed',
    cancelledMsg: 'This ticket was cancelled',
    yourTurn: "It's your turn",
    goTo: 'Go to',
    queuePass: 'Queue Pass',
    peopleWaiting: 'people waiting before you',
    youreNext: "you're next",
    thankYou: 'Thank you for waiting so patiently.',
  },
  ar: {
    notFoundTitle: 'تعذّر العثور على هذه التذكرة',
    notFoundBody: 'تعذّر العثور على هذه التذكرة. قد يكون الرابط غير صحيح.',
    disabledTitle: 'التتبع المباشر غير متاح',
    disabledBody: 'التتبع المباشر غير متاح حاليًا. يرجى متابعة الشاشة في منطقة الانتظار.',
    prevDayTitle: 'هذه التذكرة كانت ليوم سابق',
    prevDayBody: 'هذه التذكرة كانت ليوم سابق ولم تعد قيد التتبع. يرجى أخذ تذكرة جديدة إذا كنت لا تزال بحاجة إليها.',
    served: 'تم إنهاء خدمتك، شكرًا لك',
    missed: 'تم تسجيل هذه التذكرة كغياب',
    cancelledMsg: 'تم إلغاء هذه التذكرة',
    yourTurn: 'حان دورك',
    goTo: 'توجه إلى',
    queuePass: 'بطاقة الانتظار',
    peopleWaiting: 'في انتظار الخدمة قبلك',
    youreNext: 'أنت التالي',
    thankYou: 'شكرًا لصبركم الجميل أثناء الانتظار',
  },
  mr: {
    notFoundTitle: 'हे तिकीट सापडले नाही',
    notFoundBody: 'दुवा चुकीचा टाइप झाला असावा, किंवा तिकीट आता उपलब्ध नाही.',
    disabledTitle: 'थेट माग उपलब्ध नाही',
    disabledBody: 'कृपया तुमच्या क्रमांकासाठी प्रतीक्षा कक्षातील स्क्रीनकडे लक्ष द्या.',
    prevDayTitle: 'हे तिकीट मागील दिवसाचे होते',
    prevDayBody: 'या टोकनचा माग आता ठेवला जात नाही. गरज असल्यास कृपया नवीन तिकीट घ्या.',
    served: 'तुमची सेवा पूर्ण झाली — धन्यवाद',
    missed: 'हे तिकीट अनुपस्थित म्हणून नोंदवले गेले',
    cancelledMsg: 'हे तिकीट रद्द करण्यात आले',
    yourTurn: 'तुमची पाळी आली आहे',
    goTo: 'येथे जा',
    queuePass: 'रांग पास',
    peopleWaiting: 'तुमच्या आधी प्रतीक्षेत',
    youreNext: 'तुमचा नंबर पुढे आहे',
    thankYou: 'संयमाने प्रतीक्षा केल्याबद्दल धन्यवाद.',
  },
  hi: {
    notFoundTitle: 'यह टिकट नहीं मिला',
    notFoundBody: 'हो सकता है लिंक गलत टाइप हुआ हो, या टिकट अब उपलब्ध नहीं है.',
    disabledTitle: 'लाइव ट्रैकिंग उपलब्ध नहीं है',
    disabledBody: 'कृपया अपने नंबर के लिए प्रतीक्षा क्षेत्र की स्क्रीन देखें.',
    prevDayTitle: 'यह टिकट पिछले दिन का था',
    prevDayBody: 'इस टोकन को अब ट्रैक नहीं किया जा रहा है. ज़रूरत हो तो कृपया नया टिकट लें.',
    served: 'आपकी सेवा पूरी हुई — धन्यवाद',
    missed: 'यह टिकट अनुपस्थित के रूप में चिह्नित किया गया',
    cancelledMsg: 'यह टिकट रद्द कर दिया गया',
    yourTurn: 'अब आपकी बारी है',
    goTo: 'यहाँ जाएँ',
    queuePass: 'कतार पास',
    peopleWaiting: 'आपसे पहले प्रतीक्षा में',
    youreNext: 'अगली बारी आपकी है',
    thankYou: 'धैर्यपूर्वक प्रतीक्षा करने के लिए धन्यवाद.',
  },
}

// Deliberately coarse — this reads as a calm status line, not a stopwatch,
// so it buckets by minute rather than ticking seconds.
function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return 'a few seconds ago'
  const m = Math.round(s / 60)
  if (m === 1) return '1 min ago'
  if (m < 60) return `${m} min ago`
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
  const [canManualRefresh, setCanManualRefresh] = useState(false)

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

      // Backoff on error: 5s → 10 → 20 → 40 → 60, capped. Otherwise flat.
      const delay = errorStreak > 0
        ? Math.min(60000, 5000 * 2 ** errorStreak)
        : AUTO_POLL_MS

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

  // The "X ago" label and the manual-refresh cooldown both key off the same
  // clock — recomputed here (never read as Date.now() minus a stored
  // timestamp during render, which the purity rule for components rejects)
  // and restarted every time lastUpdatedAt actually moves. Ticks every 10s
  // rather than every second on purpose: this is a calm status line, not a
  // live stopwatch. Paused on document.hidden the same way polling is.
  useEffect(() => {
    function update() {
      const elapsed = Date.now() - lastUpdatedAt
      setAgoLabel(formatAgo(elapsed))
      setCanManualRefresh(elapsed >= MANUAL_REFRESH_COOLDOWN_MS)
    }
    update()
    let intervalId: ReturnType<typeof setInterval> | null = null
    function start() {
      if (intervalId !== null) return
      intervalId = setInterval(update, 10000)
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

  // The base locale is always primary (it cannot be turned off — see
  // SchoolSettingsForm); anything else the school enabled renders as a
  // secondary line beneath, exactly as Arabic does today.
  const locales = coerceLocales(status.languages)
  const secondaries = locales.slice(1)
  const schoolName = status.schoolNameEn || 'Queue'

  return (
    <div className="min-h-dvh bg-[#f3f6f1] bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(20,83,45,0.07),transparent_60%)] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Header logoUrl={status.logoUrl} schoolName={schoolName} schoolNameMap={status.schoolName} schoolNameAr={status.schoolNameAr} secondaries={secondaries} />

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
                secondaries={secondaries}
                justCalled={justCalled}
                connected={connected}
                isFetching={isFetching}
                agoLabel={agoLabel}
                canManualRefresh={canManualRefresh}
                onRefresh={() => manualRefreshRef.current?.()}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Header({ logoUrl, schoolName, schoolNameMap, schoolNameAr, secondaries }: {
  logoUrl?: string
  schoolName: string
  schoolNameMap?: Record<string, string>
  schoolNameAr?: string
  secondaries: Locale[]
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
        {secondaries.map((l) => {
          const name = pickLocale(schoolNameMap, l) || (l === 'ar' ? schoolNameAr : '')
          return name ? (
            <p key={l} lang={l} className="text-[13px] text-[#78877d]" dir={dirFor(l)}>{name}</p>
          ) : null
        })}
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

// The "Updated X ago" + manual refresh row, only ever shown on a ticket
// that's actually still polling (waiting/held or called) — everything
// terminal has nothing left to refresh. The button itself is throttled to
// once a minute via canManualRefresh, so it can't be used to spam past the
// 3-minute auto cadence.
function LiveRow({ connected, isFetching, agoLabel, canManualRefresh, onRefresh }: {
  connected: boolean
  isFetching: boolean
  agoLabel: string
  canManualRefresh: boolean
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
        disabled={isFetching || !canManualRefresh}
        className="flex items-center gap-1.5 rounded-full border border-[#c9d9cd] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#166534] shadow-sm transition-colors hover:bg-[#eef3ea] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RefreshCw className={'size-3.5' + (isFetching ? ' animate-spin' : '')} />
        Refresh
      </button>
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

function Body({ status, secondaries, justCalled, connected, isFetching, agoLabel, canManualRefresh, onRefresh }: {
  status: PublicTicketStatus
  secondaries: Locale[]
  justCalled: boolean
  connected: boolean
  isFetching: boolean
  agoLabel: string
  canManualRefresh: boolean
  onRefresh: () => void
}) {
  // One secondary <p> per extra language the school enabled. `className` is the
  // muted-text style each call site would have used for its Arabic line.
  const sub = (pick: (c: TrackerCopy) => string, className = 'text-sm text-[#78716c]') =>
    secondaries.map((l) => (
      <p key={l} lang={l} dir={dirFor(l)} className={className}>
        {pick(COPY[l])}
      </p>
    ))

  if (status.status === 'not-found') {
    return (
      <InfoCard>
        <XCircle className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">{COPY.en.notFoundTitle}</p>
        <p className="text-sm text-[#78716c]">{COPY.en.notFoundBody}</p>
        {sub((c) => c.notFoundBody)}
      </InfoCard>
    )
  }

  if (status.status === 'disabled' || status.status === 'expired') {
    return (
      <InfoCard>
        <Clock3 className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">{COPY.en.disabledTitle}</p>
        <p className="text-sm text-[#78716c]">{COPY.en.disabledBody}</p>
        {sub((c) => c.disabledBody)}
      </InfoCard>
    )
  }

  // status === 'ok' from here on
  const dept = status.departmentNameEn ?? ''
  const deptFor = (l: Locale) =>
    pickLocale(status.departmentName, l) || (l === 'ar' ? (status.departmentNameAr ?? '') : '')
  const counterFor = (l: Locale) =>
    pickLocale(status.counterName, l) || (l === 'ar' ? (status.counterNameAr ?? '') : '') || status.counterNameEn || ''
  const dateLabel = formatStubDate(status.serviceDate)

  if (status.isToday === false && (status.tokenStatus === 'waiting' || status.tokenStatus === 'held')) {
    return (
      <InfoCard>
        <Clock3 className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="text-base font-semibold text-[#292524]">{COPY.en.prevDayTitle}</p>
        <p className="text-sm text-[#78716c]">
          Token {status.tokenCode} is no longer being tracked. Please take a new ticket if you still need one.
        </p>
        {sub((c) => c.prevDayBody)}
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
        <p className="text-base font-semibold text-[#166534]">{COPY.en.served}</p>
        {sub((c) => c.served)}
      </InfoCard>
    )
  }

  if (status.tokenStatus === 'no-show' || status.tokenStatus === 'cancelled') {
    const missed = status.tokenStatus === 'no-show'
    return (
      <InfoCard>
        <XCircle className="mx-auto size-8 text-[#c7c2b8]" strokeWidth={1.5} />
        <p className="font-mono text-3xl font-black tracking-tight tabular-nums text-[#292524]" dir="ltr">
          {status.tokenCode}
        </p>
        <p className="text-base font-semibold text-[#57534e]">
          {missed ? COPY.en.missed : COPY.en.cancelledMsg}
        </p>
        {sub((c) => (missed ? c.missed : c.cancelledMsg))}
      </InfoCard>
    )
  }

  if (status.tokenStatus === 'called') {
    return (
      <TicketShell
        stub={
          <div className="rounded-t-[22px] bg-[#14532d] px-6 pt-[22px] pb-[26px]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bfe0cb]">{COPY.en.yourTurn}</p>
              <p className="text-[11px] font-medium text-[#5f8a6d]">{dateLabel}</p>
            </div>
            <p className="mt-3.5 text-xs text-[#9fc2ab]">{dept}</p>
            {secondaries.map((l) => deptFor(l) ? (
              <p key={l} lang={l} dir={dirFor(l)} className="mt-0.5 text-[11px] text-[#5f8a6d]">{deptFor(l)}</p>
            ) : null)}
            <p className="mt-2.5 font-mono text-[52px] font-black leading-none tracking-tight text-white" dir="ltr">
              {status.tokenCode}
            </p>
          </div>
        }
      >
        <LiveRow
          connected={connected}
          isFetching={isFetching}
          agoLabel={agoLabel}
          canManualRefresh={canManualRefresh}
          onRefresh={onRefresh}
        />
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
            {COPY.en.goTo} {status.counterNameEn || 'the counter'}
          </p>
          {secondaries.map((l) => (
            <p key={l} lang={l} dir={dirFor(l)} className="mt-1 text-sm font-semibold text-[#3f6b4a]">
              {COPY[l].goTo} {counterFor(l)}
            </p>
          ))}
        </motion.div>
      </TicketShell>
    )
  }

  // waiting / held, today
  const ahead = status.waitingAhead ?? 0
  const line = aheadLine(ahead)
  const proximity = proximityOf(status)

  return (
    <TicketShell
      stub={
        <div className="rounded-t-[22px] border-b border-[#e7e0cd] bg-[#fdfaf3] px-6 pt-[22px] pb-[26px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#166534]">{COPY.en.queuePass}</p>
            <p className="text-[11px] font-medium text-[#a8a29e]">{dateLabel}</p>
          </div>
          <p className="mt-3.5 text-xs text-[#57534e]">{dept}</p>
          {secondaries.map((l) => deptFor(l) ? (
            <p key={l} lang={l} dir={dirFor(l)} className="mt-0.5 text-[11px] text-[#a8a29e]">{deptFor(l)}</p>
          ) : null)}
          <p className="mt-2.5 font-mono text-[52px] font-black leading-none tracking-tight text-[#14532d]" dir="ltr">
            {status.tokenCode}
          </p>
        </div>
      }
    >
      <LiveRow
        connected={connected}
        isFetching={isFetching}
        agoLabel={agoLabel}
        canManualRefresh={canManualRefresh}
        onRefresh={onRefresh}
      />

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

      {secondaries.map((l) => (
        <p key={l} lang={l} dir={dirFor(l)} className="mt-1.5 text-xs text-[#78716c]">
          {line[l]}
        </p>
      ))}

      <div className="mt-5 border-t border-dashed border-[#d9e2d3] pt-4 text-center">
        <p className="text-sm font-medium text-[#3f6b4a]">{COPY.en.thankYou}</p>
        {secondaries.map((l) => (
          <p key={l} lang={l} dir={dirFor(l)} className="mt-1 text-sm text-[#78877d]">
            {COPY[l].thankYou}
          </p>
        ))}
      </div>
    </TicketShell>
  )
}
