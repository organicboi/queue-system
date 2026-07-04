'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, PlusCircle, CheckCircle2, Printer, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { useCounterHeartbeat } from '@/lib/hooks/useCounterPresence'
import { counterCreateEntryAction, counterCancelEntryAction } from '@/lib/actions/counters'
import { CounterPresenceAlert } from '@/components/counter/CounterPresenceAlert'
import { formatTime } from '@/lib/queueUtils'
import { flipNumber } from '@/lib/animations'
import { silentPrint, buildReceiptHtml } from '@/lib/silentPrint'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterId: string
  counterName: string
  counterToken: string
  branchName: string
  silentPrintEnabled: boolean
  printerName: string
}

type Step = 'entry' | 'success'

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' },
  'in-progress': { label: 'Serving', className: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200' },
  completed: { label: 'Done', className: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
  'no-show': { label: 'No-show', className: 'bg-orange-50 text-orange-600' },
}

export function OrderCounter({
  branchId, counterId, counterName, counterToken, branchName, silentPrintEnabled, printerName,
}: Props) {
  const { entries, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()
  useCounterHeartbeat(counterToken)

  const [step, setStep] = useState<Step>('entry')
  const [billNumber, setBillNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [createdEntry, setCreatedEntry] = useState<QueueEntryDTO | null>(null)
  const [printEntry, setPrintEntry] = useState<QueueEntryDTO | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'entry') setTimeout(() => inputRef.current?.focus(), 50)
  }, [step])

  useEffect(() => {
    if (!printEntry) return
    const timer = setTimeout(async () => {
      const receiptEl = document.getElementById('order-print')
      const html = buildReceiptHtml(receiptEl?.innerHTML ?? '')
      const method = await silentPrint({ html, printerName, forceDialog: !silentPrintEnabled })
      if (method === 'qz') setPrintEntry(null)
    }, 80)
    return () => clearTimeout(timer)
  }, [printEntry, silentPrintEnabled, printerName])

  useEffect(() => {
    const handler = () => setPrintEntry(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  const recentOrders = entries
    .slice()
    .sort((a, b) => b.queueNumber - a.queueNumber)
    .slice(0, 8)

  function handleSubmit() {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await counterCreateEntryAction(branchId, counterToken, trimmed, customerName.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.entry) {
        setCreatedEntry(result.entry)
        setStep('success')
        toast.success(`Queue #${result.entry.queueNumber} — Bill ${result.entry.billNumber}`)
        setPrintEntry(result.entry)
      }
    })
  }

  function handleAddAnother() {
    setBillNumber('')
    setCustomerName('')
    setCreatedEntry(null)
    setStep('entry')
  }

  function handleCancel(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCancelEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`#${entry.queueNumber} cancelled`)
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Print styles — 80mm thermal */}
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          * { box-sizing: border-box; }
          .no-print { display: none !important; }
          #order-print { display: block !important; width: 80mm; }
        }
      `}</style>

      <div id="order-print" style={{ display: 'none' }}>
        {printEntry && (
          <div style={{
            width: '80mm', padding: '5mm 4mm 6mm',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#000', textAlign: 'center',
          }}>
            <p style={{ fontSize: '13pt', fontWeight: '700', margin: '0 0 1.5mm', letterSpacing: '0.5px' }}>{branchName}</p>
            <p style={{ fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '2.5px', color: '#555', margin: '0 0 4mm' }}>Queue Ticket</p>
            <div style={{ borderTop: '1px dashed #888', margin: '0 0 4mm' }} />
            <p style={{ fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#777', margin: '0 0 2mm' }}>Queue Number</p>
            <p style={{ fontSize: '52pt', fontWeight: '900', lineHeight: '1', margin: '0 0 4mm', letterSpacing: '-1px' }}>#{printEntry.queueNumber}</p>
            <div style={{ borderTop: '1px dashed #888', margin: '0 0 4mm' }} />
            <p style={{ fontSize: '11pt', fontWeight: '600', margin: '0 0 2mm' }}>Bill {printEntry.billNumber}</p>
            <p style={{ fontSize: '8pt', color: '#777', margin: '0 0 5mm' }}>{formatTime(printEntry.joinedAt)}</p>
            <div style={{ borderTop: '1px dashed #888', margin: '0 0 3mm' }} />
            <p style={{ fontSize: '7pt', color: '#999', margin: '0' }}>Thank you for your patience</p>
          </div>
        )}
      </div>

      <div className="no-print flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="size-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <ClipboardList className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-none mb-0.5">
                  Order
                </p>
                <h1 className="text-sm md:text-base font-semibold text-gray-900 leading-tight">{counterName}</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-3 md:px-4 lg:px-6 py-4 md:py-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <ClipboardList className="size-10 mb-3 animate-pulse text-gray-300" />
              <p className="text-sm text-gray-500">Loading…</p>
            </div>
          ) : (
            <>
              <CounterPresenceAlert branchId={branchId} selfCounterId={counterId} />

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">New Order</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">Take a customer&apos;s order</p>
                </div>

                <div className="p-4">
                  <AnimatePresence mode="wait">
                    {step === 'entry' ? (
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
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-widest text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            Customer Name (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Walk-in"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleSubmit}
                          disabled={!billNumber.trim() || pending}
                          className="w-full h-11 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all select-none disabled:opacity-40"
                        >
                          <PlusCircle className="size-4" />
                          Generate Queue Number
                        </button>
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
                              <CheckCircle2 className="size-3.5 text-teal-600" />
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
                          <button
                            onClick={handleAddAnother}
                            className="flex-1 h-10 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            Add Another
                          </button>
                          {createdEntry && (
                            <button
                              onClick={() => setPrintEntry(createdEntry)}
                              title="Print ticket"
                              className="h-10 px-3.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              <Printer className="size-4 text-gray-600" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Recent orders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Recent Orders</p>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-400">Orders you create will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recentOrders.map((entry) => {
                      const pill = STATUS_PILL[entry.status]
                      return (
                        <div
                          key={entry.id}
                          className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                        >
                          <span className="font-mono font-black text-base text-gray-900 tabular-nums w-8 shrink-0">
                            {entry.queueNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">Bill {entry.billNumber}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <Clock className="size-3" />
                              {formatTime(entry.joinedAt)}
                            </div>
                          </div>
                          {pill && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${pill.className}`}>
                              {pill.label}
                            </span>
                          )}
                          {entry.status === 'waiting' && (
                            <button
                              onClick={() => handleCancel(entry)}
                              disabled={pending}
                              title="Cancel this order"
                              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              <XCircle className="size-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
