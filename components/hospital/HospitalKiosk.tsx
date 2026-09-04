'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Stethoscope, HeartPulse, Bone, Baby, Eye, Brain, Ear, Smile, Syringe,
  Microscope, ScanLine, TestTube, Pill, Receipt, CreditCard, ClipboardList,
  Thermometer, Activity, UserPlus, Users, Building2, Cross, Accessibility,
  Info, ChevronLeft, ChevronRight, Loader2, Ticket, Check, AlertCircle, Star,
  QrCode, type LucideIcon,
} from 'lucide-react'
import { departmentBlock } from '@/lib/hospital/deptBlock'
import { hospitalIssueTokenAction } from '@/lib/actions/hospital-tokens'
import { fetchHospitalKioskFeedAction } from '@/lib/actions/hospital-read'
import {
  printHospitalTicket, prepareTicketQr, prepareTicketLogo, qrCaptionLine, waitingAheadLine,
  type TicketLogo,
} from '@/lib/hospital/printTicket'
import { publicTrackingUrl } from '@/lib/hospital/constants'
import type {
  HospitalDepartmentDTO, HospitalSettingsDTO, HospitalKioskFeed, HospitalTokenDTO,
} from '@/lib/db/hospital-types'
import type { Locale } from '@/lib/region'
import { coerceLocales, defaultLocale, dirFor, LOCALE_LABEL, pickLocale } from '@/lib/region'

const ICONS: Record<string, LucideIcon> = {
  Stethoscope, HeartPulse, Bone, Baby, Eye, Brain, Ear, Smile, Syringe,
  Microscope, ScanLine, TestTube, Pill, Receipt, CreditCard, ClipboardList,
  Thermometer, Activity, UserPlus, Users, Building2, Cross, Accessibility, Info,
}
const DeptIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICONS[name] ?? Stethoscope
  return <Icon className={className} />
}

const FEED_POLL_MS = 8000

const PRIORITY_CATEGORIES: { key: string; label: Record<Locale, string> }[] = [
  { key: 'senior', label: { en: 'Senior citizen (60+)', hi: 'वरिष्ठ नागरिक (60+)', mr: 'ज्येष्ठ नागरिक (60+)', ar: 'كبار السن (60+)' } },
  { key: 'pregnant', label: { en: 'Pregnant', hi: 'गर्भवती', mr: 'गर्भवती', ar: 'حامل' } },
  { key: 'differently-abled', label: { en: 'Differently-abled', hi: 'दिव्यांग', mr: 'दिव्यांग', ar: 'من ذوي الهمم' } },
  { key: 'emergency', label: { en: 'Emergency', hi: 'आपातकाल', mr: 'आणीबाणी', ar: 'طارئ' } },
]

interface KioskDoctor {
  id: string
  name: string
  departmentId: string
  specialization: string
  feePaise: number
}

interface Props {
  branchToken: string
  hospitalName: string
  departments: HospitalDepartmentDTO[]
  doctors: KioskDoctor[]
  settings: HospitalSettingsDTO | null
  silentPrintEnabled: boolean
  printerName: string
  initialFeed: HospitalKioskFeed
  publicTrackingEnabled: boolean
  serviceDate: string
}

type Hero = {
  token: HospitalTokenDTO
  department: HospitalDepartmentDTO
  doctorName: string | null
  waitingAhead: number | null
}

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    pick: 'Choose a department', pickDoctor: 'Choose a doctor', anyDoctor: 'No preference',
    priority: 'Do any of these apply?', none: 'None — continue', confirm: 'Get token',
    yourToken: 'Your token', waiting: 'people ahead of you', proceed: 'Please watch the board',
    back: 'Back', fee: 'Fee', notSetUp: 'No doctors on duty for this department today',
    issuing: 'Issuing…', tryReception: 'Please ask at reception',
    pickHint: 'Touch a department to take your token', walkIn: 'Registration & triage',
    doctorsOnDuty: 'doctors on duty', doctorOnDuty: '1 doctor on duty',
    noDoctorsToday: 'No doctors on duty today', waitingHere: 'waiting', noQueue: 'No queue',
    inQueue: 'In queue', issuedToday: 'Issued today',
    nextPatient: 'Next patient', tapAnywhere: 'Tap anywhere to continue',
    trackTurn: 'Track your turn', priorityTag: 'Priority',
  },
  hi: {
    pick: 'विभाग चुनें', pickDoctor: 'डॉक्टर चुनें', anyDoctor: 'कोई भी',
    priority: 'क्या इनमें से कोई लागू है?', none: 'कोई नहीं — आगे बढ़ें', confirm: 'टोकन लें',
    yourToken: 'आपका टोकन', waiting: 'लोग आपसे पहले', proceed: 'कृपया बोर्ड देखें',
    back: 'वापस', fee: 'शुल्क', notSetUp: 'आज इस विभाग में कोई डॉक्टर नहीं',
    issuing: 'जारी हो रहा है…', tryReception: 'कृपया रिसेप्शन पर पूछें',
    pickHint: 'टोकन लेने के लिए विभाग पर स्पर्श करें', walkIn: 'पंजीकरण और प्राथमिक जाँच',
    doctorsOnDuty: 'डॉक्टर उपलब्ध', doctorOnDuty: '1 डॉक्टर उपलब्ध',
    noDoctorsToday: 'आज कोई डॉक्टर उपलब्ध नहीं', waitingHere: 'प्रतीक्षा में', noQueue: 'कतार नहीं',
    inQueue: 'कतार में', issuedToday: 'आज जारी',
    nextPatient: 'अगला मरीज़', tapAnywhere: 'जारी रखने के लिए कहीं भी स्पर्श करें',
    trackTurn: 'अपनी बारी देखें', priorityTag: 'प्राथमिकता',
  },
  mr: {
    pick: 'विभाग निवडा', pickDoctor: 'डॉक्टर निवडा', anyDoctor: 'कोणीही',
    priority: 'यापैकी काही लागू आहे का?', none: 'काहीही नाही — पुढे चला', confirm: 'टोकन घ्या',
    yourToken: 'तुमचे टोकन', waiting: 'लोक तुमच्या आधी', proceed: 'कृपया बोर्ड पहा',
    back: 'मागे', fee: 'शुल्क', notSetUp: 'आज या विभागात डॉक्टर नाहीत',
    issuing: 'जारी होत आहे…', tryReception: 'कृपया रिसेप्शनला विचारा',
    pickHint: 'टोकन घेण्यासाठी विभागाला स्पर्श करा', walkIn: 'नोंदणी व प्राथमिक तपासणी',
    doctorsOnDuty: 'डॉक्टर उपलब्ध', doctorOnDuty: '1 डॉक्टर उपलब्ध',
    noDoctorsToday: 'आज कोणतेही डॉक्टर उपलब्ध नाहीत', waitingHere: 'प्रतीक्षेत', noQueue: 'रांग नाही',
    inQueue: 'रांगेत', issuedToday: 'आज जारी',
    nextPatient: 'पुढील रुग्ण', tapAnywhere: 'सुरू ठेवण्यासाठी कुठेही स्पर्श करा',
    trackTurn: 'तुमची पाळी पहा', priorityTag: 'प्राधान्य',
  },
  ar: {
    pick: 'اختر القسم', pickDoctor: 'اختر الطبيب', anyDoctor: 'لا تفضيل',
    priority: 'هل ينطبق أي مما يلي؟', none: 'لا شيء — متابعة', confirm: 'احصل على تذكرة',
    yourToken: 'تذكرتك', waiting: 'أشخاص قبلك', proceed: 'يرجى متابعة الشاشة',
    back: 'رجوع', fee: 'الرسوم', notSetUp: 'لا يوجد أطباء في هذا القسم اليوم',
    issuing: 'جارٍ الإصدار…', tryReception: 'يرجى السؤال في الاستقبال',
    pickHint: 'المس القسم للحصول على تذكرتك', walkIn: 'التسجيل والفرز',
    doctorsOnDuty: 'أطباء في الخدمة', doctorOnDuty: 'طبيب واحد في الخدمة',
    noDoctorsToday: 'لا يوجد أطباء اليوم', waitingHere: 'في الانتظار', noQueue: 'لا يوجد طابور',
    inQueue: 'في الطابور', issuedToday: 'صدرت اليوم',
    nextPatient: 'المريض التالي', tapAnywhere: 'المس أي مكان للمتابعة',
    trackTurn: 'تتبع دورك', priorityTag: 'أولوية',
  },
}

const STEP_LABELS: Record<Locale, [string, string, string]> = {
  en: ['Department', 'Doctor', 'Token'],
  hi: ['विभाग', 'डॉक्टर', 'टोकन'],
  mr: ['विभाग', 'डॉक्टर', 'टोकन'],
  ar: ['القسم', 'الطبيب', 'التذكرة'],
}

export function HospitalKiosk({
  branchToken, hospitalName, departments, doctors, settings,
  silentPrintEnabled, printerName, initialFeed, publicTrackingEnabled, serviceDate,
}: Props) {
  const languages = useMemo(() => coerceLocales(settings?.languages), [settings?.languages])
  const [lang, setLang] = useState<Locale>(languages[0] ?? defaultLocale())
  const c = COPY[lang] ?? COPY.en
  const idleSeconds = settings?.kioskIdleSeconds ?? 20
  const printEnabled = settings?.printEnabled ?? true
  const priorityEnabled = settings?.priorityEnabled ?? true

  const [feed, setFeed] = useState(initialFeed)
  const [dept, setDept] = useState<HospitalDepartmentDTO | null>(null)
  // Only set at the moment of issue — picking a doctor *is* the commit, so
  // this exists to say which card should carry the spinner, not to hold a
  // half-made choice across a screen.
  const [doctor, setDoctor] = useState<KioskDoctor | null>(null)
  const [priority, setPriority] = useState<string | null>(null)
  const [hero, setHero] = useState<Hero | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketLogo, setTicketLogo] = useState<TicketLogo | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const qrImgRef = useRef<HTMLImageElement>(null)

  // Three screens, not four. A desk that isn't an OPD speciality issues on the
  // tap itself, so the grid holds — with the pressed card spinning — rather
  // than flashing a confirm screen the patient never gets to use; an OPD
  // speciality issues on the doctor tap, with the priority question answered
  // in place above the list. The old confirm step asked a patient to press
  // "Get token" after they had already pressed the thing they wanted.
  const step: 'grid' | 'doctor' | 'hero' =
    hero ? 'hero' : dept?.type === 'opd' ? 'doctor' : 'grid'

  const deptDoctors = useMemo(
    () => (dept ? doctors.filter((d) => d.departmentId === dept.id) : []),
    [dept, doctors]
  )
  const deptName = useCallback(
    (d: HospitalDepartmentDTO | null | undefined) => (d ? pickLocale(d.name, lang) : ''),
    [lang]
  )

  // How many of today's doctors sit behind each OPD card. The grid says this
  // up front so nobody picks a speciality that has nobody in it today and only
  // finds out on the next screen.
  const doctorCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of doctors) counts[d.departmentId] = (counts[d.departmentId] ?? 0) + 1
    return counts
  }, [doctors])

  // Rendered only after mount: a clock painted on the server is a clock that
  // hydrates wrong, and this one sits in the header of an always-on terminal.
  // It ticks on the minute band, not the second — nobody walks up to a kiosk
  // to read a seconds hand.
  const [clock, setClock] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        `${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}  ·  ` +
          now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
      )
    }
    tick()
    const id = setInterval(tick, 20000)
    return () => clearInterval(id)
  }, [])

  // Feed poll — the kiosk can't subscribe with the publishable key.
  const refresh = useCallback(async () => {
    const next = await fetchHospitalKioskFeedAction(branchToken)
    if (next.status === 'ok') setFeed(next)
  }, [branchToken])
  useEffect(() => {
    const id = setInterval(refresh, FEED_POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Prepare the logo bitmap once per session.
  useEffect(() => {
    const url = settings?.logoUrl
    if (!url) return
    let cancelled = false
    prepareTicketLogo(url).then((logo) => { if (!cancelled) setTicketLogo(logo) })
    return () => { cancelled = true }
  }, [settings?.logoUrl])

  // The neutral screen the next patient should meet. Reached three ways: the
  // idle timer below, the "next patient" button, and a tap anywhere on the
  // token screen — a patient who has read their number should not have to wait
  // it out, and neither should the person behind them.
  const resetForNextPatient = useCallback(() => {
    setHero(null); setDept(null); setDoctor(null); setPriority(null)
    setError(null); setLang(languages[0] ?? defaultLocale())
  }, [languages])

  useEffect(() => {
    if (!hero) return
    const t = setTimeout(resetForNextPatient, idleSeconds * 1000)
    return () => clearTimeout(t)
  }, [hero, idleSeconds, resetForNextPatient])

  // Resolved out here rather than inside the JSX: the doctor step reads it in
  // a branch that also calls issue(), and an inline IIFE there trips the
  // refs-during-render rule.
  const deptBlock = useMemo(() => (dept ? departmentBlock(dept.color) : null), [dept])

  const heroPriorityLabel = useMemo(() => {
    const key = hero?.token.priorityCategory
    if (!key) return null
    const found = PRIORITY_CATEGORIES.find((p) => p.key === key)
    // A category this build doesn't know (a server-side addition) shows
    // nothing rather than a raw key.
    return found ? found.label[lang] ?? found.label.en : null
  }, [hero?.token.priorityCategory, lang])

  const trackingUrl =
    publicTrackingEnabled && hero?.token.publicCode
      ? publicTrackingUrl(hero.token.publicCode, typeof window !== 'undefined' ? window.location.origin : '')
      : ''

  async function issue(targetDept: HospitalDepartmentDTO, targetDoctor: KioskDoctor | null) {
    if (issuing) return
    setIssuing(true)
    setError(null)
    const result = await hospitalIssueTokenAction(
      branchToken, targetDept.id, targetDoctor?.id ?? null, priority, lang
    )
    setIssuing(false)
    if (result.error || !result.token) {
      setError(result.error ?? c.tryReception)
      return
    }
    const h: Hero = {
      token: result.token,
      department: targetDept,
      doctorName: targetDoctor?.name ?? null,
      waitingAhead: result.waitingAhead ?? null,
    }
    setHero(h)
    refresh()

    if (printEnabled) {
      // One paint so the hidden ticket (and its QR) exists before capture.
      await new Promise((r) => setTimeout(r, 140))
      if (trackingUrlFor(h) && qrCanvasRef.current && qrImgRef.current) {
        const qr = prepareTicketQr(qrCanvasRef.current)
        if (qr) qrImgRef.current.src = qr.src
      }
      const el = printRef.current
      if (el) await printHospitalTicket(el, { silentPrintEnabled, printerName })
    }
  }

  function trackingUrlFor(h: Hero) {
    return publicTrackingEnabled && h.token.publicCode
      ? publicTrackingUrl(h.token.publicCode, typeof window !== 'undefined' ? window.location.origin : '')
      : ''
  }

  const dir = dirFor(lang)

  return (
    <div dir={dir} className="kiosk-surface flex h-dvh w-screen flex-col overflow-hidden select-none">
      {/* ── Header ─────────────────────────────────────────────
          An ink bar, not a white one. It gives the terminal an edge to sit
          inside on a bright lobby wall, and it keeps the department colours
          below it as the only saturated thing on the screen. */}
      <header className="flex shrink-0 items-center gap-4 border-b border-[oklch(88%_0.008_80)] bg-[oklch(99.5%_0.004_85)] px-5 py-3 md:px-8 md:py-3.5">
        {settings?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-[oklch(24%_0.01_70)] object-contain p-1" />
        ) : (
          <div className="kiosk-display-font flex size-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(24%_0.01_70)] text-lg font-bold text-white">
            {hospitalName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="kiosk-display-font truncate text-lg font-semibold leading-tight md:text-xl">{hospitalName}</p>
          <p className="kiosk-mono truncate text-[10px] uppercase tracking-[0.14em] text-[oklch(52%_0.012_75)]">Outpatient token kiosk</p>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-3 lg:flex">
          {STEP_LABELS[lang].map((label, index) => {
            const active = (step === 'grid' && index === 0) || (step === 'doctor' && index === 1) || (step === 'hero' && index === 2)
            return <div key={label} className="flex items-center gap-2">
              <span className={`kiosk-display-font grid size-7 place-items-center rounded-full text-sm font-bold ${active ? 'bg-[oklch(45%_0.09_165)] text-white' : 'border border-[oklch(85%_0.008_80)] text-[oklch(52%_0.012_75)]'}`}>{index + 1}</span>
              <span className={`text-sm ${active ? 'font-semibold text-[oklch(30%_0.012_75)]' : 'text-[oklch(58%_0.012_75)]'}`}>{label}</span>
              {index < 2 && <span className="mx-1 h-px w-8 bg-[oklch(86%_0.008_80)]" />}
            </div>
          })}
        </div>

        {step === 'grid' && (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <HeaderStat icon={<Users className="size-4" />} value={feed.waitingTotal ?? 0} label={c.inQueue} />
            <HeaderStat icon={<Ticket className="size-4" />} value={feed.issuedToday ?? 0} label={c.issuedToday} />
          </div>
        )}

        {languages.length > 1 && step !== 'hero' && (
          <div className="flex shrink-0 gap-1 rounded-xl bg-[oklch(95%_0.004_85)] p-1">
            {languages.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                dir={dirFor(l)}
                className={
                  l === lang
                    ? 'rounded-lg bg-white px-3 py-2 text-sm font-bold text-[oklch(24%_0.01_70)] shadow-sm md:text-base'
                    : 'rounded-lg px-3 py-2 text-sm font-medium text-[oklch(52%_0.012_75)] active:bg-white md:text-base'
                }
              >
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        )}
        <div className="hidden text-right sm:block">
          <p className="kiosk-mono text-sm font-semibold tabular-nums text-[oklch(24%_0.01_70)]">{clock ?? '\u00a0'}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[oklch(52%_0.012_75)]">Today</p>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-8 md:py-5">
        {/* ── Choose a department ──────────────────────────────
            Colour blocks, not white cards with a colour hairline. A patient
            who comes every month learns "the teal one" long before they read
            a word of it, and a solid field carries that from the door where
            a tinted border does not. Everything on a card is therefore one
            ink on the fill — the colour does the identifying, so nothing else
            competes for it. The rows are height-bounded rather than 1fr, so
            three departments make three sane cards instead of three banners,
            and twelve still land on one screen with nothing to scroll for. */}
        {step === 'grid' && (
          <div className="flex h-full flex-col animate-[kiosk-step-in_240ms_ease-out]">
            <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[oklch(88%_0.008_80)] pb-4">
              <div>
                <h1 className="kiosk-display-font text-3xl font-semibold leading-none tracking-tight text-[oklch(24%_0.01_70)] md:text-5xl">{c.pick}</h1>
                <p className="mt-2 text-base text-[oklch(46%_0.012_75)] md:text-lg">{c.pickHint}</p>
              </div>
              <div className="kiosk-mono flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[oklch(48%_0.012_75)]"><span className="size-2 animate-pulse rounded-full bg-[oklch(58%_0.14_150)]" />Live queue</div>
            </div>

            {/* A walk-up desk issues on the tap itself and stays on this
                screen, so a failure has to be said here — otherwise the tap
                just appears to do nothing. */}
            {error && (
              <p className="mb-3 flex shrink-0 items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <AlertCircle className="size-5 shrink-0" /> {error}
              </p>
            )}

            <div className="grid min-h-0 flex-1 auto-rows-[minmax(9rem,1fr)] grid-cols-1 gap-3 pb-1 sm:grid-cols-2 xl:grid-cols-3 md:gap-4">
              {departments.map((d) => {
                const block = departmentBlock(d.color)
                const queued = feed.waitingByDepartment?.[d.id] ?? 0
                const onDuty = doctorCount[d.id] ?? 0
                const sub =
                  d.type !== 'opd'
                    ? c.walkIn
                    : onDuty === 0
                      ? c.noDoctorsToday
                      : onDuty === 1
                        ? c.doctorOnDuty
                        : `${onDuty} ${c.doctorsOnDuty}`
                return (
                  <button
                    key={d.id}
                    disabled={issuing}
                    onClick={() => {
                      setDept(d)
                      setDoctor(null)
                      setPriority(null)
                      setError(null)
                      if (d.type !== 'opd') issue(d, null)
                    }}
                    className={
                      'relative flex min-h-[9rem] flex-col items-stretch justify-between gap-4 overflow-hidden rounded-2xl px-5 py-4 text-start transition duration-150 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0.5 active:[background-color:var(--dept-pressed)] md:px-6 md:py-5' +
                      // While a token is in flight the rest of the wall steps
                      // back, so the eye never loses the block it just chose.
                      (issuing && dept?.id !== d.id ? ' scale-[0.985] opacity-40' : '')
                    }
                    style={{
                      backgroundColor: block.fill,
                      color: block.on,
                      // Tinted with the card's own colour so the block sits on
                      // the ground instead of floating over it, plus a hairline
                      // of its own ink so a pale block still has an edge.
                      boxShadow: `0 9px 20px -6px ${block.fill}66, inset 0 0 0 1px ${block.onWash}`,
                      ['--dept-pressed' as string]: block.pressed,
                    }}
                  >
                    {/* One soft highlight bled off the trailing corner — enough
                        to keep a large flat field from reading as printed
                        paper, and cheaper than a gradient on a kiosk panel. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -end-16 -top-24 size-56 rounded-full"
                      style={{ backgroundColor: block.onWash }}
                    />

                    <span
                      className="relative flex size-11 shrink-0 items-center justify-center rounded-xl md:size-12"
                      style={{ backgroundColor: block.onWash }}
                    >
                      <DeptIcon name={d.icon} className="size-7 md:size-8" />
                    </span>

                    <span className="relative flex min-w-0 items-end justify-between gap-3">
                      <span className="kiosk-display-font block truncate text-2xl font-semibold leading-tight md:text-3xl">
                        {deptName(d)}
                      </span>
                      <span
                        className="mt-1 block truncate text-sm font-medium md:text-base"
                        style={{ color: block.onSoft }}
                      >
                        {sub}
                      </span>
                    </span>

                    {/* Queue length as a figure, not a chip: it is the one
                        number that changes a patient's mind about which
                        department to join first. */}
                    <span className="relative shrink-0 text-end">
                      <span className="block font-mono text-3xl font-black leading-none tabular-nums md:text-4xl" dir="ltr">
                        {queued}
                      </span>
                      <span
                        className="mt-1.5 block text-[11px] font-semibold uppercase tracking-wide md:text-xs"
                        style={{ color: block.onSoft }}
                      >
                        {queued === 0 ? c.noQueue : c.waitingHere}
                      </span>
                    </span>

                    <ChevronRight
                      aria-hidden
                      className="relative size-6 shrink-0 rtl:rotate-180"
                      style={{ color: block.onSoft }}
                    />

                    {issuing && dept?.id === d.id && (
                      <span className="absolute inset-0 grid place-items-center bg-black/25">
                        <Loader2 className="size-9 animate-spin text-white" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Choose a doctor ──────────────────────────────────
            The head repeats the department as its own colour block in
            miniature — the tile the patient just pressed follows them here,
            and again onto the chip on the token screen, so three screens read
            as one errand rather than three forms. The priority question is
            answered in place above the list; tapping a doctor is the commit. */}
        {step === 'doctor' && dept && deptBlock && (
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col animate-[kiosk-step-in_240ms_ease-out]">
            <div className="shrink-0">
              <button
                onClick={() => { setDept(null); setDoctor(null); setPriority(null); setError(null) }}
                className="mb-4 inline-flex h-11 items-center gap-2 rounded-xl border border-[oklch(89%_0.008_80)] bg-[oklch(99.5%_0.004_85)] ps-3 pe-5 text-sm font-semibold text-[oklch(38%_0.012_75)] shadow-sm active:bg-[oklch(94%_0.008_80)]"
              >
                <ChevronLeft className="size-5 rtl:rotate-180" /> {c.back}
              </button>

              <div className="flex items-center gap-4">
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: deptBlock.fill, color: deptBlock.on }}
                >
                  <DeptIcon name={dept.icon} className="size-7" />
                </span>
                <span className="min-w-0">
                   <span className="kiosk-display-font block truncate text-3xl font-semibold leading-tight text-[oklch(24%_0.01_70)] md:text-4xl">
                    {deptName(dept)}
                  </span>
                   <span className="block truncate text-[oklch(46%_0.012_75)]">{c.pickDoctor}</span>
                </span>
              </div>

              {priorityEnabled && deptDoctors.length > 0 && (
                <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                  <p className="mb-2.5 text-sm font-semibold text-slate-800">{c.priority}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_CATEGORIES.map((p) => {
                      const on = priority === p.key
                      return (
                        <button
                          key={p.key}
                          disabled={issuing}
                          onClick={() => setPriority(on ? null : p.key)}
                          className={
                            'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm transition ' +
                            (on
                              ? 'border-2 border-accent-500 bg-accent-50 font-bold text-accent-700'
                              : 'border border-slate-200 font-medium text-slate-600 active:bg-slate-50')
                          }
                        >
                          {on && <Check className="size-4" />}
                          {p.label[lang] ?? p.label.en}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertCircle className="size-5 shrink-0" /> {error}
                </p>
              )}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">
              {deptDoctors.length === 0 ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {c.notSetUp}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {deptDoctors.map((d) => {
                    const busy = issuing && doctor?.id === d.id
                    return (
                      <button
                        key={d.id}
                        disabled={issuing}
                        onClick={() => { setDoctor(d); setError(null); issue(dept, d) }}
                        className={
                           'relative flex items-center gap-3.5 overflow-hidden rounded-2xl border bg-[oklch(99.5%_0.004_85)] p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-[oklch(45%_0.09_165)] active:scale-[0.985] ' +
                          (busy ? 'border-accent-500' : 'border-transparent') +
                          (issuing && !busy ? ' opacity-45' : '')
                        }
                      >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                          <Stethoscope className="size-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-slate-900">{d.name}</span>
                          {d.specialization && (
                            <span className="block truncate text-xs text-slate-500">{d.specialization}</span>
                          )}
                        </span>
                        {d.feePaise > 0 && (
                          <span className="shrink-0 text-sm font-semibold text-slate-600" dir="ltr">
                            {c.fee} ₹{(d.feePaise / 100).toFixed(0)}
                          </span>
                        )}
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-slate-300 rtl:rotate-180" />
                        {busy && (
                          <span className="absolute inset-0 grid place-items-center bg-white/80">
                            <Loader2 className="size-7 animate-spin text-accent-600" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Your token ───────────────────────────────────────
            Deliberately the school kiosk's confirmation, part for part: the
            same success mark, the same tracked-out label over a card-sized
            numeral, the same chips, the same QR card beside it. What is
            hospital-specific rides in the chips and one line — the doctor, the
            priority the patient declared, and how many people are ahead.
            It clears itself on the branch's idle timer, but a tap anywhere or
            the button ends it early: nobody should hold the kiosk for the
            person behind them. */}
        {step === 'hero' && hero && (
          <div
            onClick={resetForNextPatient}
            className="flex h-full flex-col items-center justify-center gap-4 animate-[kiosk-step-in_240ms_ease-out]"
          >
            <div className="flex flex-col items-stretch justify-center gap-4 lg:flex-row lg:items-center">
              <div className="flex flex-col items-center rounded-3xl border border-[oklch(89%_0.008_80)] bg-[oklch(99.5%_0.004_85)] px-9 py-7 shadow-lg shadow-[oklch(24%_0.01_70_/_0.08)]">
                <span className="grid size-13 place-items-center rounded-full bg-emerald-50">
                  <Check className="size-8 text-emerald-600" />
                </span>
                <p className="kiosk-mono mt-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[oklch(52%_0.012_75)]">
                  {c.yourToken}
                </p>
                <p
                  dir="ltr"
                  className="kiosk-display-font mt-1 text-[clamp(4rem,12vh,9rem)] font-bold leading-none tracking-tight tabular-nums text-[oklch(45%_0.09_165)]"
                >
                  {hero.token.tokenCode}
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <HeroChip
                    icon={<DeptIcon name={hero.department.icon} className="size-5" />}
                    label={deptName(hero.department)}
                    color={departmentBlock(hero.department.color).fill}
                  />
                  {hero.doctorName && (
                    <HeroChip
                      icon={<Stethoscope className="size-5" />}
                      label={hero.doctorName}
                      color="var(--color-accent-600)"
                    />
                  )}
                  {heroPriorityLabel && (
                    <HeroChip
                      icon={<Star className="size-5" />}
                      label={heroPriorityLabel}
                      // The priority amber, same value the Flutter kiosk's
                      // KioskPalette.priority carries. Not a themable token:
                      // priority means the same thing at every property.
                      color="#b45309"
                    />
                  )}
                </div>

                {hero.waitingAhead !== null && (
                  <p className="mt-4 text-center text-base text-slate-500">
                    <span dir="ltr" className="font-extrabold text-slate-900">{hero.waitingAhead}</span>{' '}
                    {c.waiting}
                  </p>
                )}
                <p className="mt-1.5 text-center text-base text-[oklch(46%_0.012_75)]">{c.proceed}</p>

                <button
                  onClick={resetForNextPatient}
                  className="mt-6 min-w-56 rounded-xl bg-[oklch(45%_0.09_165)] px-8 py-4 text-lg font-bold text-white hover:bg-[oklch(38%_0.09_165)] active:bg-[oklch(38%_0.09_165)]"
                >
                  {c.nextPatient}
                </button>
              </div>

              {trackingUrl && (
                <div className="flex flex-col items-center rounded-3xl border border-[oklch(89%_0.008_80)] bg-[oklch(99.5%_0.004_85)] px-7 py-7 shadow-lg shadow-[oklch(24%_0.01_70_/_0.08)]">
                  <span className="grid size-13 place-items-center rounded-full bg-accent-50">
                    <QrCode className="size-7 text-accent-600" />
                  </span>
                  <p className="kiosk-mono mt-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[oklch(52%_0.012_75)]">
                    {c.trackTurn}
                  </p>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2.5">
                    <QRCodeCanvas value={trackingUrl} size={160} level="M" />
                  </div>
                  <p className="mt-2.5 max-w-52 text-center text-slate-500">
                    {qrCaptionLine()[lang] ?? qrCaptionLine().en}
                  </p>
                  {/* The idle window itself, running down in step with the
                      auto-reset — the bar emptying and the screen closing are
                      the same event, not two clocks that can drift. */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      key={hero.token.id}
                      className="h-full w-full origin-left rounded-full bg-accent-600 rtl:origin-right"
                      style={{ animation: `kiosk-countdown ${idleSeconds}s linear forwards` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-400">{c.tapAnywhere}</p>
          </div>
        )}
      </main>

      {/* Hidden ticket for capture */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div ref={printRef} style={{ width: '48mm', padding: '2mm', background: '#fff', color: '#000', fontFamily: 'monospace' }}>
          {hero && (
            <div style={{ textAlign: 'center' }}>
              {ticketLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ticketLogo.src} alt="" style={{ width: `${ticketLogo.widthMm}mm`, margin: '0 auto 2mm' }} />
              )}
              <div style={{ fontSize: '9pt', fontWeight: 700 }}>{hospitalName}</div>
              <div style={{ fontSize: '28pt', fontWeight: 900, margin: '2mm 0' }}>{hero.token.tokenCode}</div>
              <div style={{ fontSize: '9pt' }}>{deptName(hero.department)}</div>
              {hero.doctorName && <div style={{ fontSize: '9pt' }}>{hero.doctorName}</div>}
              {hero.waitingAhead !== null && (
                <div style={{ fontSize: '8pt', margin: '1mm 0' }}>
                  {waitingAheadLine(hero.waitingAhead)[lang] ?? waitingAheadLine(hero.waitingAhead).en}
                </div>
              )}
              <div style={{ fontSize: '7pt' }}>{serviceDate} · {new Date(hero.token.joinedAt).toLocaleTimeString()}</div>
              {trackingUrl && (
                <div style={{ margin: '2mm 0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={qrImgRef} alt="" style={{ width: '26mm', margin: '0 auto' }} />
                  <div style={{ fontSize: '7pt' }}>{qrCaptionLine()[lang] ?? qrCaptionLine().en}</div>
                </div>
              )}
              {languages.map((l) => {
                const f = settings?.ticketFooter?.[l]
                return f ? <div key={l} style={{ fontSize: '7pt' }} dir={dirFor(l)}>{f}</div> : null
              })}
            </div>
          )}
        </div>
        {/* Scratch QR canvas — read back as a crisp bitmap by prepareTicketQr. */}
        {hero && trackingUrl && (
          <QRCodeCanvas ref={qrCanvasRef} value={trackingUrl} size={300} level="M" />
        )}
      </div>
    </div>
  )
}

/**
 * One live figure in the ink bar. Two of these answer the question a patient
 * asks before they have chosen anything — "how busy is this place right now" —
 * without spending any of the grid's room on it. Hidden below `sm`, where the
 * language pills need the width more.
 */
function HeaderStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[oklch(95%_0.004_85)] px-3.5 py-2">
      <span className="text-[oklch(52%_0.012_75)]">{icon}</span>
      <span className="leading-tight">
        <span className="block font-mono text-lg font-black tabular-nums" dir="ltr">{value}</span>
        <span className="block text-[11px] font-medium text-[oklch(52%_0.012_75)]">{label}</span>
      </span>
    </div>
  )
}

/**
 * One fact about the token, tinted with the colour it belongs to: the
 * department's own hue, the accent for the doctor, the priority amber. Same
 * shape as the school confirmation's chips, so a patient who has used either
 * kiosk reads them the same way.
 */
function HeroChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span
      className="inline-flex max-w-64 items-center gap-2 rounded-full px-4 py-2.5 text-[17px] font-bold"
      // color-mix rather than an appended alpha hex, so `color` can be a CSS
      // variable (the themable accent) as readily as a department's own hex.
      style={{ backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}
