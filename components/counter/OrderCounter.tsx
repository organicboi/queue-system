'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, CheckCircle2, Printer, Delete, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import { useCounterHeartbeat } from '@/lib/hooks/useCounterPresence'
import { counterCreateEntryAction, counterCancelEntryAction } from '@/lib/actions/counters'
import { CounterPresenceAlert } from '@/components/counter/CounterPresenceAlert'
import { ConsoleFrame, ConsoleLoading, KeypadKey, RowCancel, STATUS_PILL } from '@/components/counter/console'
import { formatTime } from '@/lib/queueUtils'
import { silentPrint, buildReceiptHtml } from '@/lib/silentPrint'
import { isAndroid, printViaRawBT } from '@/lib/rawbtPrint'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  counterId: string
  counterName: string
  counterToken: string
  branchName: string
  silentPrintEnabled: boolean
  printerName: string
  presenceEnabled?: boolean
}

const MAX_BILL_LENGTH = 12
const HIGHLIGHT_DURATION_MS = 3000

export function OrderCounter({
  branchId, counterId, counterName, counterToken, branchName, silentPrintEnabled, printerName, presenceEnabled = false,
}: Props) {
  const { entries, isLoading } = useRealtimeQueue(branchId)
  const [pending, startTransition] = useTransition()
  useCounterHeartbeat(counterToken, presenceEnabled)

  const [billNumber, setBillNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [printEntry, setPrintEntry] = useState<QueueEntryDTO | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!printEntry) return
    const timer = setTimeout(async () => {
      const receiptEl = document.getElementById('order-print')
      if (!receiptEl) return

      if (silentPrintEnabled && isAndroid()) {
        await printViaRawBT(receiptEl)
        setPrintEntry(null)
        return
      }

      const html = buildReceiptHtml(receiptEl.innerHTML)
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
    .slice(0, 10)

  function append(text: string) {
    setBillNumber((prev) => (prev + text).slice(0, MAX_BILL_LENGTH))
  }

  function handleBackspace() {
    setBillNumber((prev) => prev.slice(0, -1))
  }

  function handleClear() {
    setBillNumber('')
  }

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
        toast.success(`Queue #${result.entry.queueNumber} — Bill ${result.entry.billNumber}`)
        setPrintEntry(result.entry)

        // Reset the form immediately for the next customer — no success screen,
        // the new entry is highlighted in the recent orders list instead.
        setBillNumber('')
        setCustomerName('')

        setHighlightId(result.entry.id)
        if (highlightTimer.current) clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_DURATION_MS)
      }
    })
  }

  function handleCancel(entry: QueueEntryDTO) {
    startTransition(async () => {
      const result = await counterCancelEntryAction(entry.id, branchId, counterToken)
      if (result.error) toast.error(result.error)
      else toast.success(`#${entry.queueNumber} cancelled`)
    })
  }

  function handleReprint(entry: QueueEntryDTO) {
    setPrintEntry(entry)
  }

  return (
    <>
      {/* Print styles — 80mm thermal */}
      <style>{`
        @page { size: 80mm 45mm; margin: 0; }
        #order-print.rawbt-capturing { display: block !important; position: fixed; left: -9999px; top: 0; }
        @media print {
          * { box-sizing: border-box; }
          .no-print { display: none !important; }
          #order-print { display: block !important; width: 80mm; }
        }
      `}</style>

      <div id="order-print" style={{ display: 'none' }}>
        {printEntry && (
          <div style={{
            width: '80mm', padding: '2mm 4mm',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#000', textAlign: 'center',
          }}>
            <p style={{ fontSize: '11pt', fontWeight: '700', margin: '0 0 0.5mm', letterSpacing: '0.5px' }}>{branchName}</p>
            <p style={{ fontSize: '6pt', textTransform: 'uppercase', letterSpacing: '2px', color: '#555', margin: '0 0 1.5mm' }}>Queue Ticket</p>
            <div style={{ borderTop: '1px dashed #888', margin: '0 0 1.5mm' }} />
            <p style={{ fontSize: '36pt', fontWeight: '900', lineHeight: '1', margin: '0 0 1.5mm', letterSpacing: '-1px' }}>#{printEntry.queueNumber}</p>
            <div style={{ borderTop: '1px dashed #888', margin: '0 0 1.5mm' }} />
            <p style={{ fontSize: '10pt', fontWeight: '600', margin: '0 0 0.5mm' }}>Bill {printEntry.billNumber}</p>
            <p style={{ fontSize: '7pt', color: '#777', margin: '0' }}>{formatTime(printEntry.joinedAt)}</p>
          </div>
        )}
      </div>

      <div className="no-print">
        <ConsoleFrame
          icon={ClipboardList}
          name={counterName}
          typeLabel="Order · Ticket Station"
          banner={<CounterPresenceAlert branchId={branchId} selfCounterId={counterId} enabled={presenceEnabled} />}
        >
          {isLoading ? (
            <ConsoleLoading icon={ClipboardList} />
          ) : (
              <div className="h-full grid gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] landscape:grid-rows-1 landscape:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                {/* Ticket-entry panel */}
                <section className="min-h-0">
                  <div className="h-full flex flex-col rounded-3xl border border-slate-200 bg-white p-4 gap-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]">
                    <h2 className="text-lg font-bold text-slate-800 leading-tight text-center shrink-0">Enter Bill Number</h2>

                    {/* Bill display — fed by the on-screen pad; virtual keyboard suppressed. */}
                    <div className="relative shrink-0 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-600/10 transition-colors">
                      <input
                        ref={inputRef}
                        type="text"
                        inputMode="none"
                        placeholder="Bill number"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value.slice(0, MAX_BILL_LENGTH))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        className="w-full h-[4.5rem] bg-transparent text-center text-5xl font-mono font-black tracking-wider tabular-nums text-slate-900 placeholder:text-lg placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none"
                      />
                    </div>

                    <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-600/10 transition-colors">
                      <input
                        type="text"
                        placeholder="Customer name (optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        className="w-full h-11 bg-transparent px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>

                    {/* Keypad: dimensional keys + tall gradient Create Ticket. */}
                    <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                      <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-2 min-h-0">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                          <KeypadKey key={d} onTap={() => append(d)} disabled={pending}>{d}</KeypadKey>
                        ))}
                        <KeypadKey variant="danger" onTap={handleClear} disabled={pending}>Clear</KeypadKey>
                        <KeypadKey onTap={() => append('0')} disabled={pending}>0</KeypadKey>
                        <KeypadKey variant="muted" onTap={handleBackspace} disabled={pending} aria-label="Backspace">
                          <Delete className="size-6" />
                        </KeypadKey>
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!billNumber.trim() || pending}
                        className="rounded-2xl bg-accent-600 text-white flex flex-col items-center justify-center gap-2 select-none transition active:translate-y-px active:bg-accent-700 disabled:opacity-40 disabled:active:translate-y-0 shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]"
                      >
                        <Ticket className="size-8" />
                        <span className="text-base font-bold uppercase tracking-wide leading-tight text-center px-1">Generate<br />Ticket</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* Recent orders */}
                <section className="min-h-0 flex flex-col">
                  <div className="flex items-center gap-2 px-1.5 pb-2 shrink-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent Orders</p>
                    <span className="ms-auto min-w-6 h-6 px-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center shadow-sm">
                      {recentOrders.length}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin space-y-2 px-0.5 pb-1">
                    {recentOrders.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
                        <div className="size-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                          <ClipboardList className="size-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-500">No orders yet</p>
                        <p className="text-xs mt-1">Tickets you create appear here</p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {recentOrders.map((entry) => {
                          const pill = STATUS_PILL[entry.status]
                          const isHighlighted = entry.id === highlightId
                          return (
                            <motion.div
                              key={entry.id}
                              layout
                              initial={{ opacity: 0, y: -8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className={`rounded-2xl border px-3 py-2 flex items-center gap-3 transition-colors duration-700 ${
                                isHighlighted
                                  ? 'bg-accent-50 border-accent-300'
                                  : 'bg-white border-slate-200 shadow-sm'
                              }`}
                            >
                              <span className={`size-11 rounded-xl flex items-center justify-center font-mono font-black text-lg tabular-nums shrink-0 border ${
                                isHighlighted
                                  ? 'bg-accent-600 text-white border-accent-600'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {entry.queueNumber}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">
                                  Bill {entry.billNumber}
                                  {entry.customerName && <span className="font-normal text-slate-400"> · {entry.customerName}</span>}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-slate-400 tabular-nums">{formatTime(entry.joinedAt)}</span>
                                  {!isHighlighted && pill && (
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pill.className}`}>
                                      {pill.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isHighlighted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-accent-600 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shrink-0">
                                  <CheckCircle2 className="size-3" />
                                  Added
                                </span>
                              ) : entry.status === 'waiting' ? (
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleReprint(entry)}
                                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold flex items-center justify-center gap-1 shadow-sm active:bg-slate-50 active:scale-95 transition"
                                  >
                                    <Printer className="size-3.5" />
                                    Reprint
                                  </button>
                                  <RowCancel disabled={pending} onConfirm={() => handleCancel(entry)} />
                                </div>
                              ) : null}
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </section>
              </div>
          )}
        </ConsoleFrame>
      </div>
    </>
  )
}
