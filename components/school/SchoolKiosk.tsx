'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Loader2, Printer, TriangleAlert } from 'lucide-react'
import { schoolIssueTokenAction } from '@/lib/actions/school-tokens'
import { printSchoolTicket } from '@/lib/school/printTicket'
import { formatDate, formatTime } from '@/lib/queueUtils'
import type {
  SchoolDepartmentDTO, SchoolSettingsDTO, SchoolTokenDTO, SchoolLanguage,
} from '@/lib/db/school-types'

interface Props {
  branchToken: string
  branchName: string
  departments: SchoolDepartmentDTO[]
  settings: SchoolSettingsDTO | null
  silentPrintEnabled: boolean
  printerName: string
}

const COPY = {
  en: {
    prompt: 'Please select a service',
    priority: 'Priority assistance',
    priorityHint: 'Senior citizens and visitors needing assistance',
    yourToken: 'Your token number',
    watch: 'Please watch the screen for your number',
    printing: 'Printing your ticket…',
    printFailed: 'The printer is unavailable. Please note your number.',
    issuing: 'Issuing…',
  },
  ar: {
    prompt: 'يرجى اختيار الخدمة',
    priority: 'مساعدة ذوي الأولوية',
    priorityHint: 'كبار السن والزوار الذين يحتاجون إلى مساعدة',
    yourToken: 'رقم تذكرتك',
    watch: 'يرجى متابعة الشاشة لظهور رقمك',
    printing: 'جارٍ طباعة التذكرة…',
    printFailed: 'الطابعة غير متاحة. يرجى تدوين رقمك.',
    issuing: 'جارٍ الإصدار…',
  },
} as const

export function SchoolKiosk({
  branchToken, branchName, departments, settings, silentPrintEnabled, printerName,
}: Props) {
  const languages: SchoolLanguage[] = settings?.languages?.length ? settings.languages : ['en']
  const [lang, setLang] = useState<SchoolLanguage>(languages[0])
  const [priority, setPriority] = useState(false)
  const [issued, setIssued] = useState<{ token: SchoolTokenDTO; department: SchoolDepartmentDTO } | null>(null)
  const [printState, setPrintState] = useState<'idle' | 'printing' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const printRef = useRef<HTMLDivElement>(null)

  const t = COPY[lang]
  const rtl = lang === 'ar'
  const idleSeconds = settings?.kioskIdleSeconds ?? 20
  const priorityEnabled = settings?.priorityEnabled ?? true
  const printEnabled = settings?.printEnabled ?? true
  const schoolName =
    (rtl ? settings?.schoolNameAr : settings?.schoolNameEn) || settings?.schoolNameEn || branchName

  // Preload the logo: the first print fires within ~100ms of the tap, too fast
  // for a cold image decode, and html2canvas would capture an empty box.
  useEffect(() => {
    const url = settings?.logoUrl
    if (!url) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = url
  }, [settings?.logoUrl])

  // Auto-reset so the next visitor always meets a clean screen.
  useEffect(() => {
    if (!issued) return
    const timer = setTimeout(() => {
      setIssued(null)
      setPriority(false)
      setPrintState('idle')
      setLang(languages[0])
    }, idleSeconds * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issued, idleSeconds])

  function selectDepartment(department: SchoolDepartmentDTO) {
    if (pending || issued) return
    setError(null)

    startTransition(async () => {
      const result = await schoolIssueTokenAction(
        branchToken,
        department.id,
        priority || department.isPriority
      )
      if (result.error || !result.token) {
        setError(result.error ?? 'Please ask for assistance')
        return
      }

      // The token is committed before printing is attempted, and it stays on
      // screen regardless — a printer failure must never leave a visitor with
      // no number at all.
      setIssued({ token: result.token, department })

      if (!printEnabled) return
      setPrintState('printing')
      // One paint so the hidden ticket exists before it's rasterised.
      await new Promise((r) => setTimeout(r, 100))
      const el = printRef.current
      if (!el) { setPrintState('failed'); return }
      const method = await printSchoolTicket(el, { silentPrintEnabled, printerName })
      setPrintState(method === 'failed' ? 'failed' : 'idle')
    })
  }

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-100">
      <style>{`
        @page { size: 80mm 80mm; margin: 0; }
        #school-ticket.rawbt-capturing { display: block !important; position: fixed; left: -9999px; top: 0; }
        @media print {
          .no-print { display: none !important; }
          #school-ticket { display: block !important; width: 80mm; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print flex shrink-0 items-center gap-4 bg-slate-900 px-6 py-4 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold md:text-2xl">{schoolName}</p>
          <p className="truncate text-sm text-slate-400">{branchName}</p>
        </div>
        {languages.length > 1 && (
          <div className="flex shrink-0 gap-2">
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={
                  l === lang
                    ? 'rounded-xl bg-accent-600 px-5 py-2.5 text-base font-semibold text-white'
                    : 'rounded-xl border border-slate-600 px-5 py-2.5 text-base font-medium text-slate-300 active:bg-slate-800'
                }
              >
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="no-print flex min-h-0 flex-1 flex-col p-4 md:p-6">
        <AnimatePresence mode="wait">
          {issued ? (
            <motion.div
              key="issued"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <p className="text-xl font-medium text-slate-500 md:text-2xl">{t.yourToken}</p>
              <p
                dir="ltr"
                className="font-mono font-black tabular-nums text-accent-700"
                style={{ fontSize: 'clamp(6rem, 24vw, 20rem)', lineHeight: 1 }}
              >
                {issued.token.tokenCode}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-800 md:text-3xl">
                {rtl ? issued.department.nameAr || issued.department.nameEn : issued.department.nameEn}
              </p>
              <p className="mt-4 text-lg text-slate-500 md:text-xl">{t.watch}</p>

              {printState === 'printing' && (
                <p className="mt-6 flex items-center gap-2 text-base text-slate-500">
                  <Printer className="size-4" />
                  {t.printing}
                </p>
              )}
              {printState === 'failed' && (
                <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-base font-medium text-amber-700">
                  <TriangleAlert className="size-4" />
                  {t.printFailed}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <p className="mb-4 shrink-0 text-center text-2xl font-semibold text-slate-700 md:text-3xl">
                {t.prompt}
              </p>

              {error && (
                <p className="mb-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-base font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    disabled={pending}
                    onClick={() => selectDepartment(dept)}
                    className="flex min-h-24 items-center gap-4 rounded-2xl px-6 py-5 text-start text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                    style={{ backgroundColor: dept.color }}
                  >
                    <span
                      dir="ltr"
                      className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20 font-mono text-2xl font-black"
                    >
                      {dept.prefix}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-bold md:text-2xl">
                        {rtl ? dept.nameAr || dept.nameEn : dept.nameEn}
                      </span>
                      {!rtl && dept.nameAr && (
                        <span dir="rtl" className="block truncate text-base text-white/80">
                          {dept.nameAr}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {priorityEnabled && (
                <button
                  type="button"
                  onClick={() => setPriority((v) => !v)}
                  className={
                    priority
                      ? 'mt-3 flex shrink-0 items-center gap-4 rounded-2xl border-4 border-amber-500 bg-amber-50 px-6 py-4 text-start'
                      : 'mt-3 flex shrink-0 items-center gap-4 rounded-2xl border-2 border-slate-300 bg-white px-6 py-4 text-start active:bg-slate-50'
                  }
                >
                  <Accessibility className={priority ? 'size-8 text-amber-600' : 'size-8 text-slate-400'} />
                  <span className="min-w-0 flex-1">
                    <span className={priority ? 'block text-xl font-bold text-amber-800' : 'block text-xl font-semibold text-slate-700'}>
                      {t.priority}
                    </span>
                    <span className="block truncate text-sm text-slate-500">{t.priorityHint}</span>
                  </span>
                  {priority && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              )}

              {pending && (
                <p className="mt-3 flex shrink-0 items-center justify-center gap-2 text-base text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  {t.issuing}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 80 mm × 80 mm thermal ticket. Square on purpose: it locks the image
          aspect ratio so RawBT always rasterises to the same size, and the
          centred content leaves tear offset so the cutter never clips. */}
      <div id="school-ticket" ref={printRef} style={{ display: 'none' }}>
        {issued && (
          <div
            style={{
              width: '80mm', height: '80mm', boxSizing: 'border-box', padding: '6mm 4mm',
              fontFamily: "'Courier New', Courier, monospace",
              color: '#000', textAlign: 'center',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            {settings?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '24mm', height: 'auto', margin: '0 0 2mm' }}
              />
            )}
            <p style={{ fontSize: '12pt', fontWeight: 700, margin: '0 0 2mm' }}>
              {settings?.schoolNameEn || branchName}
            </p>
            <p style={{ fontSize: '52pt', fontWeight: 900, lineHeight: 1, margin: '0 0 2mm' }}>
              {issued.token.tokenCode}
            </p>
            <p style={{ fontSize: '13pt', fontWeight: 700, margin: '0 0 1mm' }}>
              {issued.department.nameEn}
            </p>
            {issued.token.isPriority && (
              <p style={{ fontSize: '10pt', fontWeight: 700, margin: '0 0 1mm' }}>PRIORITY</p>
            )}
            <p style={{ fontSize: '9pt', fontWeight: 700, margin: '0 0 1mm' }}>
              {formatDate(issued.token.joinedAt)} · {formatTime(issued.token.joinedAt)}
            </p>
            {settings?.ticketFooterEn && (
              <p style={{ fontSize: '8pt', margin: 0 }}>{settings.ticketFooterEn}</p>
            )}
            {settings?.ticketFooterAr && (
              <p style={{ fontSize: '8pt', margin: 0 }} dir="rtl">{settings.ticketFooterAr}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
