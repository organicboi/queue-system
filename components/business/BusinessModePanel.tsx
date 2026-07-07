'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  PlusCircle, Radio, Users, ArrowLeft, ArrowRight,
  CheckCircle, Printer, Search, X, ChevronRight, LogOut, ChefHat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { toast } from 'sonner'
import { formatTime, formatRelativeTime } from '@/lib/queueUtils'
import type { QueueEntryDTO } from '@/lib/db/types'
import { flipNumber } from '@/lib/animations'
import { silentPrint, buildReceiptHtml } from '@/lib/silentPrint'
import {
  addEntryDirectAction,
  callEntryAction,
  completeEntryAction,
} from '@/lib/actions/queue'

type Tab = 'add' | 'serving' | 'customers'
type AddStep = 'entry' | 'success'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'add', label: 'Add', Icon: PlusCircle },
  { id: 'serving', label: 'Serving', Icon: Radio },
  { id: 'customers', label: 'Queue', Icon: Users },
]

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  waiting: {
    label: 'Waiting',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  },
  'in-progress': {
    label: 'Serving',
    dot: 'bg-teal-500 animate-pulse',
    pill: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  },
  completed: {
    label: 'Done',
    dot: 'bg-green-500',
    pill: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
  },
}

// A waiting entry whose kitchen stage isn't done yet gets its own pill instead
// of the generic "Waiting" one, so staff immediately see why Call is blocked.
// This is a no-op for branches with no active kitchen counter, since those
// entries are always created kitchen_status: 'ready'.
const KITCHEN_PENDING_CONFIG = {
  label: 'Cooking',
  dot: 'bg-orange-500',
  pill: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
}

function rowStatusConfig(entry: QueueEntryDTO) {
  if (entry.status === 'waiting' && entry.kitchenStatus !== 'ready') {
    return entry.kitchenStatus === 'preparing'
      ? KITCHEN_PENDING_CONFIG
      : { ...KITCHEN_PENDING_CONFIG, label: 'In Kitchen' }
  }
  return STATUS_CONFIG[entry.status]
}

interface Props {
  branchId: string
  branchName: string
  businessName: string
  silentPrintEnabled: boolean
  printerName: string
  initialEntries: QueueEntryDTO[]
  initialServingNumber: number
  initialIsPaused: boolean
}

export function BusinessModePanel({
  branchId,
  branchName,
  businessName,
  silentPrintEnabled,
  printerName,
  initialEntries,
  initialServingNumber,
  initialIsPaused,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (['add', 'serving', 'customers'].includes(t ?? '') ? t : 'add') as Tab
  })

  const [addStep, setAddStep] = useState<AddStep>('entry')
  const [billNumber, setBillNumber] = useState('')
  const [createdEntry, setCreatedEntry] = useState<QueueEntryDTO | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [csQuery, setCsQuery] = useState('')
  const [csSelectedId, setCsSelectedId] = useState<string | null>(null)

  const [printEntry, setPrintEntry] = useState<QueueEntryDTO | null>(null)
  const [navNumber, setNavNumber] = useState<number | null>(null)

  const { entries, currentServingNumber, isPaused } = useRealtimeQueue(branchId, {
    entries: initialEntries,
    currentServingNumber: initialServingNumber,
    isPaused: initialIsPaused,
  })

  const currentEntry = entries.find(
    (e) => e.queueNumber === currentServingNumber && e.status === 'in-progress'
  )
  const waitingCount = entries.filter((e) => e.status === 'waiting').length

  const csSearchedEntry = csSelectedId
    ? entries.find((e) => e.id === csSelectedId) ?? null
    : null

  const navEntry = !csSelectedId && navNumber !== null
    ? entries.find((e) => e.queueNumber === navNumber) ?? null
    : null

  const displayEntry = csSearchedEntry ?? navEntry ?? currentEntry
  const isSearchMode = csQuery.trim().length > 0 && !csSelectedId

  const csResults = isSearchMode
    ? entries
        .filter((e) => e.status !== 'cancelled')
        .filter((e) => {
          const q = csQuery.trim().toLowerCase()
          return (
            e.billNumber.toLowerCase().includes(q) ||
            String(e.queueNumber).includes(q)
          )
        })
        .slice(0, 6)
    : []

  const customerList = entries
    .filter((e) => e.status !== 'cancelled')
    .sort((a, b) => {
      const order: Record<string, number> = { 'in-progress': 0, waiting: 1, completed: 2 }
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3)
      if (diff !== 0) return diff
      return a.queueNumber - b.queueNumber
    })

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setCsQuery('')
    setCsSelectedId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    if (tab === 'add' && addStep === 'entry') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [tab, addStep])

  useEffect(() => {
    if (!printEntry) return
    const timer = setTimeout(async () => {
      const receiptEl = document.getElementById('business-mode-print')
      const html = buildReceiptHtml(receiptEl?.innerHTML ?? '')
      const method = await silentPrint({
        html,
        printerName,
        forceDialog: !silentPrintEnabled,
      })
      if (method === 'qz') setPrintEntry(null)
    }, 80)
    return () => clearTimeout(timer)
  }, [printEntry, silentPrintEnabled, printerName])

  useEffect(() => {
    const handler = () => setPrintEntry(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  useEffect(() => { setNavNumber(null) }, [currentServingNumber])

  const handleAddSubmit = async () => {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await addEntryDirectAction(branchId, trimmed)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.entry) {
        setCreatedEntry(result.entry)
        setAddStep('success')
        toast.success(`Queue #${result.entry.queueNumber} — Bill ${result.entry.billNumber}`)
        setPrintEntry(result.entry)
      }
    })
  }

  const handleAddAnother = () => {
    setBillNumber('')
    setCreatedEntry(null)
    setAddStep('entry')
  }

  const handleCallEntry = (entry: QueueEntryDTO) => {
    startTransition(async () => {
      const result = await callEntryAction(entry.id, branchId)
      if (result.error) toast.error(result.error)
      else toast.success(`Queue #${entry.queueNumber} called!`)
    })
  }

  const handleRecallEntry = (entry: QueueEntryDTO) => {
    startTransition(async () => {
      const result = await callEntryAction(entry.id, branchId)
      if (result.error) toast.error(result.error)
      else toast.success(`Queue #${entry.queueNumber} recalled (×${(entry.recallCount ?? 0) + 1})`)
    })
  }

  const handleCompleteDisplayed = () => {
    if (!displayEntry) return
    startTransition(async () => {
      const result = await completeEntryAction(displayEntry.id, branchId)
      if (result.error) toast.error(result.error)
      else {
        toast.success(`Queue #${displayEntry.queueNumber} completed`)
        if (csSelectedId) { setCsSelectedId(null); setCsQuery('') }
      }
    })
  }

  const handlePrint = (entry: QueueEntryDTO) => {
    setPrintEntry(entry)
  }

  const displayNotReady = !!displayEntry && displayEntry.status === 'waiting' && displayEntry.kitchenStatus !== 'ready'

  return (
    <>
      {/* Print styles — 80 mm thermal, fixed 80mm total height with tear offset */}
      <style>{`
        @page { size: 80mm 80mm; margin: 0; }
        @media print {
          * { box-sizing: border-box; }
          .no-print { display: none !important; }
          #business-mode-print { display: block !important; width: 80mm; }
        }
      `}</style>

      {/* Hidden print receipt */}
      <div id="business-mode-print" style={{ display: 'none' }}>
        {printEntry && (
          <div style={{
            width: '80mm', height: '80mm', boxSizing: 'border-box', padding: '6mm 4mm',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#000', textAlign: 'center',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
          }}>
            {/* Fixed 80mm-tall ticket — locks image aspect ratio so RawBT always
                prints 80mm × 80mm; content is centered, leaving blank offset at
                the top and bottom so the auto-cut / tear never clips text. */}
            <p style={{ fontSize: '13pt', fontWeight: '700', margin: '0 0 3mm', letterSpacing: '0.5px' }}>{businessName} — {branchName}</p>
            <p style={{ fontSize: '60pt', fontWeight: '900', lineHeight: '1', margin: '0 0 3mm', letterSpacing: '-1px' }}>#{printEntry.queueNumber}</p>
            <p style={{ fontSize: '18pt', fontWeight: '700', margin: '0 0 2mm' }}>Bill {printEntry.billNumber}</p>
            <p style={{ fontSize: '9pt', fontWeight: '400', color: '#555', margin: '0' }}>{formatTime(printEntry.joinedAt)}</p>
          </div>
        )}
      </div>

      {/* Main UI */}
      <div className="no-print h-full bg-background">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white md:border-x md:border-gray-200 md:shadow-sm">

        {/* Header */}
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <Radio className="size-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-semibold text-sm leading-tight truncate">{businessName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
                <p className="text-gray-500 text-[10px] leading-tight font-medium truncate">{branchName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {waitingCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {waitingCount}
              </div>
            )}
            {isPaused && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
                Paused
              </div>
            )}
            <button
              onClick={() => router.push(`/business/${branchId}`)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors text-[11px] font-medium ml-1"
            >
              <LogOut className="size-3.5" />
              <span className="hidden xs:inline">Exit</span>
            </button>
          </div>
        </header>

        {/* Tab Bar */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-3 py-2">
          <div className="bg-gray-100 rounded-xl p-0.5 flex gap-0.5">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                {tab === id && (
                  <motion.span
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    style={{ zIndex: 0 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <Icon className={['size-3.5 relative z-10 transition-colors', tab === id ? 'text-gray-900' : 'text-gray-400'].join(' ')} />
                <span className={['relative z-10 transition-colors', tab === id ? 'text-gray-900' : 'text-gray-400'].join(' ')}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content — always scrollable, never overflow-hidden */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ADD TAB */}
            {tab === 'add' && (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-3 sm:p-4"
              >
                <div className="max-w-sm mx-auto">
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Quick Entry</p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">Add customer to queue</p>
                    </div>

                    <div className="p-4">
                      <AnimatePresence mode="wait">
                        {addStep === 'entry' ? (
                          <motion.div
                            key="entry"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.14 }}
                            className="space-y-3"
                          >
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Bill Number
                              </label>
                              <input
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                placeholder="0000"
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-widest text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 transition-colors"
                              />
                            </div>
                            <Button
                              onClick={handleAddSubmit}
                              disabled={!billNumber.trim()}
                              className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg gap-2"
                            >
                              <PlusCircle className="size-4" />
                              Generate Queue Number
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-3"
                          >
                            <div className="rounded-xl bg-teal-50 border border-teal-100 overflow-hidden">
                              <div className="p-5 text-center">
                                <div className="flex items-center justify-center gap-1.5 mb-3">
                                  <CheckCircle className="size-3.5 text-teal-600" />
                                  <span className="text-teal-700 text-[11px] font-semibold">Added successfully</span>
                                </div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 mb-1">Queue Number</p>
                                <AnimatePresence mode="wait">
                                  <motion.p
                                    key={createdEntry?.queueNumber}
                                    variants={flipNumber}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="text-7xl font-black text-teal-600 tabular-nums leading-none"
                                  >
                                    #{createdEntry?.queueNumber}
                                  </motion.p>
                                </AnimatePresence>
                                <div className="border-t border-teal-100 my-4" />
                                <p className="text-gray-700 text-sm font-mono font-semibold">Bill {createdEntry?.billNumber}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{createdEntry ? formatTime(createdEntry.joinedAt) : ''}</p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1 h-10 rounded-lg text-sm font-semibold border-gray-200 hover:bg-gray-50"
                                onClick={handleAddAnother}
                              >
                                Add Another
                              </Button>
                              {createdEntry && (
                                <Button
                                  variant="outline"
                                  className="h-10 px-3.5 rounded-lg border-gray-200 hover:bg-gray-50"
                                  onClick={() => handlePrint(createdEntry)}
                                  title="Print ticket"
                                >
                                  <Printer className="size-4 text-gray-600" />
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SERVING TAB */}
            {tab === 'serving' && (
              <motion.div
                key="serving"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-3 sm:p-4 space-y-3"
              >
                {/* Search */}
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Search queue # or bill…"
                      value={csQuery}
                      onChange={(e) => { setCsQuery(e.target.value); setCsSelectedId(null) }}
                      className="w-full h-10 rounded-lg bg-white border border-gray-200 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-teal-500 focus-visible:ring-0 transition-colors"
                    />
                    {(csQuery || csSelectedId) && (
                      <button
                        onClick={() => { setCsQuery(''); setCsSelectedId(null) }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {(isSearchMode || (csSelectedId && displayEntry)) && (
                      <motion.div
                        key="search-results"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1.5 bg-white rounded-xl border border-gray-200 max-h-44 overflow-y-auto divide-y divide-gray-100">
                          {isSearchMode ? (
                            csResults.length === 0 ? (
                              <div className="py-3 text-center text-sm text-gray-500">No matching entries</div>
                            ) : (
                              csResults.map((entry) => {
                                const cfg = rowStatusConfig(entry)
                                return (
                                  <button
                                    key={entry.id}
                                    onClick={() => { setCsSelectedId(entry.id); setCsQuery('') }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors group"
                                  >
                                    <span className="font-mono font-black text-sm text-gray-900 tabular-nums w-7 shrink-0">
                                      #{entry.queueNumber}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 truncate">Bill {entry.billNumber}</p>
                                      <p className="text-xs text-gray-500">{formatTime(entry.joinedAt)}</p>
                                    </div>
                                    {cfg && (
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.pill}`}>
                                        <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                        {cfg.label}
                                      </span>
                                    )}
                                    <ChevronRight className="size-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                                  </button>
                                )
                              })
                            )
                          ) : csSelectedId && displayEntry ? (
                            (() => {
                              const cfg = rowStatusConfig(displayEntry)
                              return (
                                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50">
                                  <span className="font-mono font-black text-sm text-gray-900 tabular-nums w-7 shrink-0">
                                    #{displayEntry.queueNumber}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">Bill {displayEntry.billNumber}</p>
                                    <p className="text-xs text-gray-500">{formatTime(displayEntry.joinedAt)}</p>
                                  </div>
                                  {cfg && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.pill}`}>
                                      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                      {cfg.label}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => { setCsQuery(''); setCsSelectedId(null) }}
                                    className="text-gray-400 hover:text-gray-700 transition-colors"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              )
                            })()
                          ) : null}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Serving card */}
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">

                  {/* Hero — semantic background based on status */}
                  <div className={[
                    'relative px-4 py-7 flex flex-col items-center justify-center min-h-47.5 transition-colors',
                    displayEntry?.status === 'in-progress' ? 'bg-teal-50' :
                    displayEntry?.status === 'waiting'     ? 'bg-amber-50' :
                    displayEntry?.status === 'completed'   ? 'bg-green-50' :
                    'bg-gray-50',
                  ].join(' ')}>

                    {waitingCount > 0 && !csSelectedId && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-amber-700 tabular-nums">{waitingCount} waiting</span>
                      </div>
                    )}

                    {displayEntry && (
                      <motion.div
                        key={displayEntry.status}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-2"
                      >
                        {displayEntry.status === 'in-progress' && (
                          <div className="flex items-center gap-1.5 bg-teal-100 border border-teal-200 rounded-full px-3 py-1">
                            <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                            <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-widest">Now Serving</span>
                          </div>
                        )}
                        {displayEntry.status === 'waiting' && (
                          <div className={[
                            'flex items-center gap-1.5 rounded-full px-3 py-1 border',
                            displayNotReady ? 'bg-orange-100 border-orange-200' : 'bg-amber-100 border-amber-200',
                          ].join(' ')}>
                            <span className={`size-1.5 rounded-full ${displayNotReady ? 'bg-orange-500' : 'bg-amber-500'}`} />
                            <span className={[
                              'text-[10px] font-semibold uppercase tracking-widest',
                              displayNotReady ? 'text-orange-700' : 'text-amber-700',
                            ].join(' ')}>
                              {displayNotReady
                                ? (displayEntry.kitchenStatus === 'preparing' ? 'Cooking' : 'Waiting on Kitchen')
                                : 'Waiting'}
                            </span>
                          </div>
                        )}
                        {displayEntry.status === 'completed' && (
                          <div className="flex items-center gap-1.5 bg-green-100 border border-green-200 rounded-full px-3 py-1">
                            <CheckCircle className="size-3 text-green-600" />
                            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-widest">Completed</span>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                      <motion.p
                        key={!csSelectedId && navNumber !== null ? navNumber : (displayEntry?.queueNumber ?? currentServingNumber)}
                        variants={flipNumber}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={[
                          'text-7xl sm:text-8xl font-black tabular-nums leading-none',
                          displayEntry?.status === 'in-progress' ? 'text-teal-600' :
                          displayEntry?.status === 'waiting'     ? 'text-amber-600' :
                          displayEntry?.status === 'completed'   ? 'text-green-700' :
                          'text-gray-300',
                        ].join(' ')}
                      >
                        #{!csSelectedId && navNumber !== null ? navNumber : (displayEntry?.queueNumber ?? currentServingNumber)}
                      </motion.p>
                    </AnimatePresence>

                    {displayEntry ? (
                      <motion.div
                        key={displayEntry.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-center"
                      >
                        <p className="text-sm font-bold text-gray-700 tracking-wide">
                          Bill {displayEntry.billNumber}
                        </p>
                        {displayEntry.startedAt && displayEntry.status === 'in-progress' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Serving for {formatRelativeTime(displayEntry.startedAt)}
                          </p>
                        )}
                        {displayEntry.completedAt && displayEntry.status === 'completed' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Completed {formatRelativeTime(displayEntry.completedAt)}
                          </p>
                        )}
                      </motion.div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400">No active entry</p>
                    )}
                  </div>

                  {/* Action zone */}
                  <div className="bg-white px-3 pt-3 pb-3.5 space-y-2 border-t border-gray-100">

                    {!csSelectedId && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setNavNumber(n => Math.max(1, (n ?? currentServingNumber) - 1))}
                          className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ArrowLeft className="size-3.5" /> Previous
                        </button>
                        <button
                          onClick={() => setNavNumber(n => (n ?? currentServingNumber) + 1)}
                          className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Next <ArrowRight className="size-3.5" />
                        </button>
                      </div>
                    )}

                    {displayEntry ? (
                      displayEntry.status === 'completed' ? (
                        <div className="h-10 flex items-center justify-center gap-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
                          <CheckCircle className="size-4 text-green-500" />
                          Completed
                        </div>
                      ) : displayEntry.status === 'cancelled' || displayEntry.status === 'no-show' ? (
                        <div className="h-10 flex items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500 font-medium capitalize">
                          {displayEntry.status}
                        </div>
                      ) : displayNotReady ? (
                        <div className="h-10 flex items-center justify-center gap-2 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-700 font-medium px-3 text-center">
                          <ChefHat className="size-4 shrink-0" />
                          Waiting on kitchen — not ready to call yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleCallEntry(displayEntry)}
                              className="flex items-center justify-center gap-1.5 h-11 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
                            >
                              <Radio className="size-4" />
                              Call
                            </button>
                            <button
                              onClick={() => handleRecallEntry(displayEntry)}
                              className="flex items-center justify-center gap-1.5 h-11 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-semibold transition-colors"
                            >
                              <Radio className="size-4" />
                              Recall
                            </button>
                          </div>

                          {((displayEntry.callCount ?? 0) > 0 || (displayEntry.recallCount ?? 0) > 0) && (
                            <p className="text-xs text-center text-gray-500 font-medium">
                              Called <span className="text-gray-700 font-bold">{displayEntry.callCount ?? 0}×</span>
                              {(displayEntry.recallCount ?? 0) > 0 && (
                                <> · Recalled <span className="text-amber-600 font-bold">{displayEntry.recallCount}×</span></>
                              )}
                            </p>
                          )}

                          <button
                            onClick={handleCompleteDisplayed}
                            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 text-xs font-semibold transition-colors"
                          >
                            <CheckCircle className="size-3.5" />
                            Mark Complete
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="h-10 flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
                        No entry selected
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* CUSTOMERS TAB */}
            {tab === 'customers' && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-3 sm:p-4 space-y-3"
              >
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'In Service',
                      count: entries.filter((e) => e.status === 'in-progress').length,
                      color: 'text-teal-700',
                      bg: 'bg-teal-50 border-teal-200',
                      dot: 'bg-teal-500',
                    },
                    {
                      label: 'Waiting',
                      count: waitingCount,
                      color: 'text-amber-600',
                      bg: 'bg-amber-50 border-amber-200',
                      dot: 'bg-amber-500',
                    },
                    {
                      label: 'Done',
                      count: entries.filter((e) => e.status === 'completed').length,
                      color: 'text-green-700',
                      bg: 'bg-green-50 border-green-200',
                      dot: 'bg-green-500',
                    },
                  ].map(({ label, count, color, bg, dot }) => (
                    <div key={label} className={`rounded-xl border ${bg} p-2.5 text-center`}>
                      <p className={`text-xl font-black tabular-nums ${color}`}>{count}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className={`size-1.5 rounded-full ${dot}`} />
                        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {customerList.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-gray-300 rounded-xl">
                    <p className="text-sm text-gray-500">No customers yet</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[2rem_1fr_4.5rem_1.75rem] gap-2 px-3 pb-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">#</span>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bill</span>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Status</span>
                      <span />
                    </div>

                    <AnimatePresence initial={false}>
                      {customerList.map((entry, i) => {
                        const cfg = rowStatusConfig(entry)
                        const isActive = entry.status === 'in-progress'
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, delay: i * 0.02 }}
                            className={[
                              'grid grid-cols-[2rem_1fr_4.5rem_1.75rem] items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                              isActive
                                ? 'bg-teal-50 border-teal-100'
                                : 'bg-white border-gray-200',
                            ].join(' ')}
                          >
                            <span className={`font-mono font-black text-base tabular-nums leading-none ${isActive ? 'text-teal-700' : 'text-gray-900'}`}>
                              {entry.queueNumber}
                            </span>
                            <div className="min-w-0">
                              <p className={`font-mono font-semibold text-sm truncate ${isActive ? 'text-teal-800' : 'text-gray-800'}`}>
                                Bill {entry.billNumber}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatTime(entry.joinedAt)}
                              </p>
                            </div>
                            {cfg ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.pill}`}>
                                <span className={`size-1.5 rounded-full ${cfg.dot} shrink-0`} />
                                {cfg.label}
                              </span>
                            ) : null}
                            <button
                              onClick={() => handlePrint(entry)}
                              className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                              title="Print ticket"
                            >
                              <Printer className="size-3.5" />
                            </button>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
      </div>
    </>
  )
}
