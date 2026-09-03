'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Stethoscope, HeartPulse, Bone, Baby, Eye, Brain, Ear, Smile, Syringe,
  Microscope, ScanLine, TestTube, Pill, Receipt, CreditCard, ClipboardList,
  Thermometer, Activity, UserPlus, Users, Building2, Cross, Accessibility,
  Info, ChevronLeft, type LucideIcon,
} from 'lucide-react'
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
  },
  hi: {
    pick: 'विभाग चुनें', pickDoctor: 'डॉक्टर चुनें', anyDoctor: 'कोई भी',
    priority: 'क्या इनमें से कोई लागू है?', none: 'कोई नहीं — आगे बढ़ें', confirm: 'टोकन लें',
    yourToken: 'आपका टोकन', waiting: 'लोग आपसे पहले', proceed: 'कृपया बोर्ड देखें',
    back: 'वापस', fee: 'शुल्क', notSetUp: 'आज इस विभाग में कोई डॉक्टर नहीं',
    issuing: 'जारी हो रहा है…', tryReception: 'कृपया रिसेप्शन पर पूछें',
  },
  mr: {
    pick: 'विभाग निवडा', pickDoctor: 'डॉक्टर निवडा', anyDoctor: 'कोणीही',
    priority: 'यापैकी काही लागू आहे का?', none: 'काहीही नाही — पुढे चला', confirm: 'टोकन घ्या',
    yourToken: 'तुमचे टोकन', waiting: 'लोक तुमच्या आधी', proceed: 'कृपया बोर्ड पहा',
    back: 'मागे', fee: 'शुल्क', notSetUp: 'आज या विभागात डॉक्टर नाहीत',
    issuing: 'जारी होत आहे…', tryReception: 'कृपया रिसेप्शनला विचारा',
  },
  ar: {
    pick: 'اختر القسم', pickDoctor: 'اختر الطبيب', anyDoctor: 'لا تفضيل',
    priority: 'هل ينطبق أي مما يلي؟', none: 'لا شيء — متابعة', confirm: 'احصل على تذكرة',
    yourToken: 'تذكرتك', waiting: 'أشخاص قبلك', proceed: 'يرجى متابعة الشاشة',
    back: 'رجوع', fee: 'الرسوم', notSetUp: 'لا يوجد أطباء في هذا القسم اليوم',
    issuing: 'جارٍ الإصدار…', tryReception: 'يرجى السؤال في الاستقبال',
  },
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
  const [doctor, setDoctor] = useState<KioskDoctor | null | 'none'>(null)
  const [priority, setPriority] = useState<string | null>(null)
  const [hero, setHero] = useState<Hero | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketLogo, setTicketLogo] = useState<TicketLogo | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const qrImgRef = useRef<HTMLImageElement>(null)

  const step: 'grid' | 'doctor' | 'confirm' | 'hero' =
    hero ? 'hero'
      : !dept ? 'grid'
        : dept.type === 'opd' && doctor === null ? 'doctor'
          : 'confirm'

  const deptDoctors = useMemo(
    () => (dept ? doctors.filter((d) => d.departmentId === dept.id) : []),
    [dept, doctors]
  )
  const deptName = useCallback(
    (d: HospitalDepartmentDTO | null | undefined) => (d ? pickLocale(d.name, lang) : ''),
    [lang]
  )

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

  // Auto-reset to a neutral screen for the next patient.
  useEffect(() => {
    if (!hero) return
    const t = setTimeout(() => {
      setHero(null); setDept(null); setDoctor(null); setPriority(null)
      setError(null); setLang(languages[0] ?? defaultLocale())
    }, idleSeconds * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, idleSeconds])

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
    <div dir={dir} className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-100 text-slate-900 select-none">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="size-9 rounded-xl bg-accent-600 flex items-center justify-center">
          <Cross className="size-5 text-white" />
        </div>
        <p className="flex-1 truncate text-lg font-bold">{hospitalName}</p>
        {languages.length > 1 && step !== 'hero' && (
          <div className="flex gap-1.5">
            {languages.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                dir={dirFor(l)}
                className={
                  l === lang
                    ? 'rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600'
                }
              >
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {step === 'grid' && (
          <>
            <h1 className="mb-4 text-xl font-bold">{c.pick}</h1>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {departments.map((d) => (
                <button
                  key={d.id}
                  disabled={issuing}
                  onClick={() => {
                    setDept(d)
                    setDoctor(d.type === 'opd' ? null : 'none')
                    if (d.type !== 'opd') issue(d, null)
                  }}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-transparent bg-white p-3 text-center shadow-sm active:border-accent-400 disabled:opacity-50"
                  style={{ borderTopColor: d.color, borderTopWidth: 6 }}
                >
                  <span
                    className="flex size-12 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: d.color }}
                  >
                    <DeptIcon name={d.icon} className="size-6" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">{deptName(d)}</span>
                  <span className="text-[11px] tabular-nums text-slate-400" dir="ltr">
                    {feed.waitingByDepartment?.[d.id] ?? 0} waiting
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'doctor' && dept && (
          <>
            <button onClick={() => { setDept(null); setDoctor(null) }} className="mb-3 flex items-center gap-1 text-sm text-slate-500">
              <ChevronLeft className="size-4" /> {c.back}
            </button>
            <h1 className="mb-1 text-xl font-bold">{c.pickDoctor}</h1>
            <p className="mb-4 text-sm text-slate-500">{deptName(dept)}</p>
            {deptDoctors.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{c.notSetUp}</p>
            ) : (
              <div className="space-y-2">
                {deptDoctors.map((d) => (
                  <button
                    key={d.id}
                    disabled={issuing}
                    onClick={() => setDoctor(d)}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-transparent bg-white p-4 text-start shadow-sm active:border-accent-400 disabled:opacity-50"
                  >
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                      <Stethoscope className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.name}</span>
                      {d.specialization && <span className="block truncate text-xs text-slate-500">{d.specialization}</span>}
                    </span>
                    {d.feePaise > 0 && (
                      <span className="shrink-0 text-sm font-semibold text-slate-600" dir="ltr">
                        {c.fee} ₹{(d.feePaise / 100).toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'confirm' && dept && (
          <>
            <button
              onClick={() => (dept.type === 'opd' ? setDoctor(null) : setDept(null))}
              className="mb-3 flex items-center gap-1 text-sm text-slate-500"
            >
              <ChevronLeft className="size-4" /> {c.back}
            </button>
            <div className="mx-auto max-w-md space-y-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">{deptName(dept)}</p>
                {doctor && doctor !== 'none' && (
                  <p className="mt-0.5 text-lg font-bold">{doctor.name}</p>
                )}
              </div>

              {priorityEnabled && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-medium">{c.priority}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_CATEGORIES.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPriority(priority === p.key ? null : p.key)}
                        className={
                          priority === p.key
                            ? 'rounded-xl border-2 border-accent-500 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700'
                            : 'rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600'
                        }
                      >
                        {p.label[lang] ?? p.label.en}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                disabled={issuing}
                onClick={() => issue(dept, doctor && doctor !== 'none' ? doctor : null)}
                className="w-full rounded-2xl bg-accent-600 py-4 text-lg font-bold text-white active:bg-accent-700 disabled:opacity-50"
              >
                {issuing ? c.issuing : c.confirm}
              </button>
            </div>
          </>
        )}

        {step === 'hero' && hero && (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 pt-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">{c.yourToken}</p>
            <p className="font-mono text-7xl font-black tabular-nums text-accent-600" dir="ltr">
              {hero.token.tokenCode}
            </p>
            <p className="text-lg font-semibold">{deptName(hero.department)}</p>
            {hero.doctorName && <p className="text-slate-600">{hero.doctorName}</p>}
            {hero.waitingAhead !== null && (
              <p className="text-slate-500">
                <span dir="ltr" className="font-bold">{hero.waitingAhead}</span> {c.waiting}
              </p>
            )}
            {trackingUrl && (
              <div className="mt-2 flex flex-col items-center gap-1">
                <QRCodeCanvas value={trackingUrl} size={128} />
                <p className="text-xs text-slate-400">{qrCaptionLine()[lang] ?? qrCaptionLine().en}</p>
              </div>
            )}
            <p className="mt-2 text-sm text-slate-400">{c.proceed}</p>
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
