"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  PlusCircle, Radio, Users, ArrowLeft, ArrowRight,
  CheckCircle, Printer, Search, X, ChevronRight, LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabaseQueue } from "@/lib/useSupabaseQueue"
import { useSettingsStore } from "@/store/settingsStore"
import { toast } from "sonner"
import { formatTime, formatRelativeTime } from "@/lib/queueUtils"
import type { QueueEntry } from "@/lib/types"
import { flipNumber } from "@/lib/animations"
import { silentPrint, buildReceiptHtml } from "@/lib/silentPrint"

type Tab = "add" | "serving" | "customers"
type AddStep = "entry" | "success"

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "add", label: "Add", Icon: PlusCircle },
  { id: "serving", label: "Serving", Icon: Radio },
  { id: "customers", label: "Customers", Icon: Users },
]

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  waiting: {
    label: "Waiting",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  "in-progress": {
    label: "Serving",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  completed: {
    label: "Done",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
  },
}

function BusinessPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab")
    return (["add", "serving", "customers"].includes(t ?? "") ? t : "add") as Tab
  })

  const [addStep, setAddStep] = useState<AddStep>("entry")
  const [billNumber, setBillNumber] = useState("")
  const [createdEntry, setCreatedEntry] = useState<QueueEntry | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [csQuery, setCsQuery] = useState("")
  const [csSelectedId, setCsSelectedId] = useState<string | null>(null)

  const [printEntry, setPrintEntry] = useState<QueueEntry | null>(null)

  const {
    entries, currentServingNumber, callNext, callPrevious,
    completeCurrentEntry, addEntry, markEntryCompleted, callEntry, recallEntry,
  } = useSupabaseQueue()
  const { businessName, silentPrint: silentPrintEnabled, printerName } = useSettingsStore()

  const currentEntry = entries.find(
    (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
  )
  const waitingCount = entries.filter((e) => e.status === "waiting").length

  const csSearchedEntry = csSelectedId
    ? entries.find((e) => e.id === csSelectedId) ?? null
    : null

  const displayEntry = csSearchedEntry ?? currentEntry
  const isSearchMode = csQuery.trim().length > 0 && !csSelectedId

  const csResults = isSearchMode
    ? entries
        .filter((e) => e.status !== "cancelled")
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
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => {
      const order = { "in-progress": 0, waiting: 1, completed: 2 }
      const diff = order[a.status as keyof typeof order] - order[b.status as keyof typeof order]
      if (diff !== 0) return diff
      return a.queueNumber - b.queueNumber
    })

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setCsQuery("")
    setCsSelectedId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", newTab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    if (tab === "add" && addStep === "entry") {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [tab, addStep])

  useEffect(() => {
    if (!printEntry) return
    const timer = setTimeout(async () => {
      const receiptEl = document.getElementById("biz-print")
      const html = buildReceiptHtml(receiptEl?.innerHTML ?? "")
      const method = await silentPrint({
        html,
        printerName,
        forceDialog: !silentPrintEnabled,
      })
      // QZ Tray completes synchronously; for window.print() wait for afterprint
      if (method === "qz") setPrintEntry(null)
    }, 80)
    return () => clearTimeout(timer)
  }, [printEntry, silentPrintEnabled, printerName])

  useEffect(() => {
    // Cleans up after window.print() path (afterprint fires when dialog closes)
    const handler = () => setPrintEntry(null)
    window.addEventListener("afterprint", handler)
    return () => window.removeEventListener("afterprint", handler)
  }, [])

  const handleAddSubmit = async () => {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    const entry = await addEntry(trimmed)
    setCreatedEntry(entry)
    setAddStep("success")
    toast.success(`Queue #${entry.queueNumber} — Bill ${entry.billNumber}`)
    handlePrint(entry)
  }

  const handleAddAnother = () => {
    setBillNumber("")
    setCreatedEntry(null)
    setAddStep("entry")
  }

  const handleCompleteDisplayed = async () => {
    if (!displayEntry) return
    if (csSelectedId) {
      await markEntryCompleted(displayEntry.queueNumber)
      toast.success(`Queue #${displayEntry.queueNumber} marked as completed`)
      setCsSelectedId(null)
      setCsQuery("")
    } else {
      const num = currentServingNumber
      await completeCurrentEntry()
      toast.success(`Queue #${num} completed`)
    }
  }

  const handlePrint = (entry: QueueEntry) => {
    setPrintEntry(entry)
  }

  const handleCsSelect = (entry: QueueEntry) => {
    setCsSelectedId(entry.id)
    setCsQuery("")
  }

  const handleCsBack = () => {
    setCsSelectedId(null)
    setCsQuery("")
  }

  return (
    <>
      {/* Print styles — 80 mm thermal paper */}
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          * { box-sizing: border-box; }
          .no-print { display: none !important; }
          #biz-print { display: block !important; width: 80mm; }
        }
      `}</style>

      {/* Print receipt */}
      <div id="biz-print" style={{ display: "none" }}>
        {printEntry && (
          <div style={{
            width: "80mm",
            padding: "5mm 4mm 6mm",
            fontFamily: "'Courier New', Courier, monospace",
            color: "#000",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "13pt", fontWeight: "700", margin: "0 0 1.5mm", letterSpacing: "0.5px" }}>
              {businessName}
            </p>
            <p style={{ fontSize: "7pt", textTransform: "uppercase", letterSpacing: "2.5px", color: "#555", margin: "0 0 4mm" }}>
              Queue Ticket
            </p>
            <div style={{ borderTop: "1px dashed #888", margin: "0 0 4mm" }} />
            <p style={{ fontSize: "7pt", textTransform: "uppercase", letterSpacing: "1.5px", color: "#777", margin: "0 0 2mm" }}>
              Queue Number
            </p>
            <p style={{ fontSize: "52pt", fontWeight: "900", lineHeight: "1", margin: "0 0 4mm", letterSpacing: "-1px" }}>
              #{printEntry.queueNumber}
            </p>
            <div style={{ borderTop: "1px dashed #888", margin: "0 0 4mm" }} />
            <p style={{ fontSize: "11pt", fontWeight: "600", margin: "0 0 2mm" }}>
              Bill {printEntry.billNumber}
            </p>
            <p style={{ fontSize: "8pt", color: "#777", margin: "0 0 5mm" }}>
              {formatTime(printEntry.joinedAt)}
            </p>
            <div style={{ borderTop: "1px dashed #888", margin: "0 0 3mm" }} />
            <p style={{ fontSize: "7pt", color: "#999", margin: "0" }}>
              Thank you for your patience
            </p>
          </div>
        )}
      </div>

      {/* Main UI */}
      <div className="no-print flex flex-col h-full bg-slate-50">

        {/* ── Header ── */}
        <header className="shrink-0 bg-slate-900 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Radio className="size-4 text-white/70" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">{businessName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-slate-400 text-[11px] leading-tight font-medium">Business Mode</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {waitingCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/20 text-amber-300 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                {waitingCount} waiting
              </div>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs font-medium"
            >
              <LogOut className="size-3.5" />
              Exit
            </button>
          </div>
        </header>

        {/* ── Segmented Tab Bar ── */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2.5">
          <div className="bg-slate-100 rounded-xl p-1 flex gap-0.5">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className="relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                {tab === id && (
                  <motion.span
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    style={{ zIndex: 0 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <Icon
                  className={[
                    "size-3.5 relative z-10 transition-colors",
                    tab === id ? "text-slate-900" : "text-slate-400",
                  ].join(" ")}
                />
                <span
                  className={[
                    "relative z-10 transition-colors",
                    tab === id ? "text-slate-900" : "text-slate-400",
                  ].join(" ")}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ════ ADD TAB ════ */}
            {tab === "add" && (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-4 md:p-5"
              >
                <div className="max-w-sm mx-auto">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Quick Entry</p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">Add a customer to the queue</p>
                    </div>

                    <div className="p-5">
                      <AnimatePresence mode="wait">
                        {addStep === "entry" ? (
                          <motion.div
                            key="entry"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.14 }}
                            className="space-y-3"
                          >
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Bill Number
                              </label>
                              <input
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                placeholder="0000"
                                value={billNumber}
                                onChange={(e) => setBillNumber(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-5 text-center text-4xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-900 focus:bg-white transition-all"
                              />
                            </div>
                            <Button
                              onClick={handleAddSubmit}
                              disabled={!billNumber.trim()}
                              className="w-full h-12 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2"
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
                            className="space-y-4"
                          >
                            {/* Ticket */}
                            <div className="rounded-2xl bg-slate-900 overflow-hidden relative">
                              <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
                                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white" />
                                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white" />
                              </div>
                              <div className="relative p-6 text-center">
                                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold mb-4">
                                  Queue Number
                                </p>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <CheckCircle className="size-5 text-emerald-400" />
                                  <span className="text-emerald-400 text-xs font-semibold">Added successfully</span>
                                </div>
                                <AnimatePresence mode="wait">
                                  <motion.p
                                    key={createdEntry?.queueNumber}
                                    variants={flipNumber}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="text-8xl font-black text-white tabular-nums leading-none mt-2"
                                  >
                                    #{createdEntry?.queueNumber}
                                  </motion.p>
                                </AnimatePresence>
                                <div className="border-t border-dashed border-white/15 my-5" />
                                <p className="text-slate-300 text-sm font-mono font-semibold">
                                  Bill {createdEntry?.billNumber}
                                </p>
                                <p className="text-slate-500 text-[11px] mt-1">
                                  {createdEntry ? formatTime(createdEntry.joinedAt) : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1 h-10 rounded-xl text-sm font-semibold border-slate-200 hover:bg-slate-50"
                                onClick={handleAddAnother}
                              >
                                Add Another
                              </Button>
                              {createdEntry && (
                                <Button
                                  variant="outline"
                                  className="h-10 px-3.5 rounded-xl border-slate-200 hover:bg-slate-50"
                                  onClick={() => handlePrint(createdEntry)}
                                  title="Print ticket"
                                >
                                  <Printer className="size-4 text-slate-600" />
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

            {/* ════ SERVING TAB ════ */}
            {tab === "serving" && (
              <motion.div
                key="serving"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-4 md:p-5 lg:p-6"
              >
                <div className="max-w-5xl mx-auto">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6 gap-4">

                    {/* ── Search Panel ── */}
                    <div className="lg:w-80 xl:w-96 shrink-0">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Search</p>
                            <p className="text-sm font-semibold text-slate-700 mt-0.5">Find a customer</p>
                          </div>
                          <AnimatePresence>
                            {csSelectedId && (
                              <motion.button
                                initial={{ opacity: 0, x: 6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ duration: 0.12 }}
                                onClick={handleCsBack}
                                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors font-medium"
                              >
                                <X className="size-3" />
                                Clear
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Search input */}
                        <div className="px-5 pt-4 pb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Find by queue # or bill…"
                              value={csQuery}
                              onChange={(e) => { setCsQuery(e.target.value); setCsSelectedId(null) }}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400"
                            />
                            {csQuery && (
                              <button
                                onClick={() => { setCsQuery(""); setCsSelectedId(null) }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Search results / selection / hint */}
                        <div className="px-5 pb-4">
                          <AnimatePresence mode="wait">
                            {isSearchMode ? (
                              <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="space-y-1.5"
                              >
                                {csResults.length === 0 ? (
                                  <div className="py-8 text-center">
                                    <p className="text-sm text-slate-400">No matching entries</p>
                                  </div>
                                ) : (
                                  csResults.map((entry) => {
                                    const cfg = STATUS_CONFIG[entry.status]
                                    return (
                                      <button
                                        key={entry.id}
                                        onClick={() => handleCsSelect(entry)}
                                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 hover:border-slate-900 hover:bg-slate-50 px-3 py-2.5 text-left transition-all group"
                                      >
                                        <span className="text-xl font-black text-slate-900 tabular-nums w-8 shrink-0 text-center">
                                          {entry.queueNumber}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-slate-800 truncate font-mono">
                                            Bill {entry.billNumber}
                                          </p>
                                          <p className="text-[11px] text-slate-400 mt-0.5">
                                            {formatTime(entry.joinedAt)}
                                          </p>
                                        </div>
                                        {cfg && (
                                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.pill}`}>
                                            <span className={`size-1.5 rounded-full ${cfg.dot} shrink-0`} />
                                            {cfg.label}
                                          </span>
                                        )}
                                        <ChevronRight className="size-3.5 text-slate-300 group-hover:text-slate-600 shrink-0 transition-colors" />
                                      </button>
                                    )
                                  })
                                )}
                              </motion.div>
                            ) : csSelectedId && displayEntry ? (
                              <motion.div
                                key="selected"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.12 }}
                              >
                                {(() => {
                                  const cfg = STATUS_CONFIG[displayEntry.status]
                                  return (
                                    <div className="flex items-center gap-3 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-2.5">
                                      <span className="text-xl font-black text-slate-900 tabular-nums w-8 shrink-0 text-center">
                                        {displayEntry.queueNumber}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate font-mono">
                                          Bill {displayEntry.billNumber}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                          {formatTime(displayEntry.joinedAt)}
                                        </p>
                                      </div>
                                      {cfg && (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.pill}`}>
                                          <span className={`size-1.5 rounded-full ${cfg.dot} shrink-0`} />
                                          {cfg.label}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })()}
                              </motion.div>
                            ) : (
                              <motion.div
                                key="hint"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="py-6 text-center"
                              >
                                <p className="text-xs text-slate-400">Type to search by queue # or bill</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* ── Serving Card + Controls ── */}
                    <div className="flex-1 min-w-0 space-y-3 md:space-y-4">

                      {/* Hero card */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-white/70 text-xs font-medium uppercase tracking-widest">
                              {csSelectedId ? "Selected Entry" : "Now Serving"}
                            </span>
                          </div>
                          {csSelectedId && displayEntry ? (
                            (() => {
                              const cfg = STATUS_CONFIG[displayEntry.status]
                              return cfg ? (
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cfg.pill}`}>
                                  <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              ) : null
                            })()
                          ) : waitingCount > 0 ? (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                              <span className="size-1.5 rounded-full bg-amber-400" />
                              {waitingCount} in queue
                            </div>
                          ) : null}
                        </div>

                        <div className="px-8 pt-10 pb-8 text-center">
                          <AnimatePresence mode="wait">
                            <motion.p
                              key={displayEntry?.queueNumber ?? currentServingNumber}
                              variants={flipNumber}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              className="text-[6.5rem] font-black text-slate-900 tabular-nums leading-none"
                            >
                              #{displayEntry?.queueNumber ?? currentServingNumber}
                            </motion.p>
                          </AnimatePresence>

                          {displayEntry ? (
                            <motion.div
                              key={displayEntry.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-5 pt-5 border-t border-slate-100 space-y-1"
                            >
                              <p className="text-base font-mono font-bold text-slate-700">
                                Bill {displayEntry.billNumber}
                              </p>
                              {displayEntry.startedAt && displayEntry.status === "in-progress" && (
                                <p className="text-xs text-slate-400">
                                  Serving for {formatRelativeTime(displayEntry.startedAt)}
                                </p>
                              )}
                              {displayEntry.completedAt && displayEntry.status === "completed" && (
                                <p className="text-xs text-slate-400">
                                  Completed {formatRelativeTime(displayEntry.completedAt)}
                                </p>
                              )}
                            </motion.div>
                          ) : (
                            <p className="text-sm text-slate-400 mt-6 pt-5 border-t border-slate-100">
                              No active entry
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Queue navigation — hidden when viewing a searched entry */}
                      {!csSelectedId && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            className="h-12 gap-2 rounded-xl border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => callPrevious()}
                          >
                            <ArrowLeft className="size-4" /> Previous
                          </Button>
                          <Button
                            variant="outline"
                            className="h-12 gap-2 rounded-xl border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => callNext()}
                          >
                            Next <ArrowRight className="size-4" />
                          </Button>
                        </div>
                      )}

                      {/* Actions */}
                      {displayEntry ? (
                        displayEntry.status === "completed" ? (
                          <div className="h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm text-emerald-600 font-semibold ring-1 ring-inset ring-emerald-100">
                            <CheckCircle className="size-4" />
                            Completed
                          </div>
                        ) : displayEntry.status === "cancelled" ? (
                          <div className="h-11 flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400 font-medium">
                            Cancelled
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                className="h-13 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
                                onClick={async () => {
                                  await callEntry(displayEntry.queueNumber)
                                  toast.success(`Queue #${displayEntry.queueNumber} called!`)
                                }}
                              >
                                <Radio className="size-5" />
                                Call
                              </Button>
                              <Button
                                className="h-13 text-base rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-2 font-semibold"
                                onClick={async () => {
                                  const next = (displayEntry.recallCount ?? 0) + 1
                                  await recallEntry(displayEntry.queueNumber)
                                  toast.success(`Queue #${displayEntry.queueNumber} recalled (×${next})`)
                                }}
                              >
                                <Radio className="size-5" />
                                Recall
                              </Button>
                            </div>
                            {((displayEntry.callCount ?? 0) > 0 || (displayEntry.recallCount ?? 0) > 0) && (
                              <p className="text-xs text-center text-slate-400">
                                Called {displayEntry.callCount ?? 0}×
                                {(displayEntry.recallCount ?? 0) > 0 && ` · Recalled ${displayEntry.recallCount}×`}
                              </p>
                            )}
                            <Button
                              className="w-full h-11 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
                              onClick={handleCompleteDisplayed}
                            >
                              <CheckCircle className="size-4" />
                              Mark Complete
                            </Button>
                          </div>
                        )
                      ) : (
                        <div className="h-11 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                          No entry to act on
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════ CUSTOMERS TAB ════ */}
            {tab === "customers" && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-4 space-y-3"
              >

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "In Service",
                      count: entries.filter((e) => e.status === "in-progress").length,
                      color: "text-emerald-600",
                      bg: "bg-emerald-50 border-emerald-200",
                      dot: "bg-emerald-500",
                    },
                    {
                      label: "Waiting",
                      count: waitingCount,
                      color: "text-amber-600",
                      bg: "bg-amber-50 border-amber-200",
                      dot: "bg-amber-400",
                    },
                    {
                      label: "Done",
                      count: entries.filter((e) => e.status === "completed").length,
                      color: "text-slate-500",
                      bg: "bg-white border-slate-200",
                      dot: "bg-slate-400",
                    },
                  ].map(({ label, count, color, bg, dot }) => (
                    <div key={label} className={`rounded-xl border ${bg} p-3 text-center`}>
                      <p className={`text-2xl font-black tabular-nums ${color}`}>{count}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className={`size-1.5 rounded-full ${dot}`} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[2.5rem_1fr_4.5rem_2rem] gap-3 px-4 pt-1">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">#</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Bill</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Status</span>
                  <span />
                </div>

                {customerList.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-sm text-slate-400">No customers yet</p>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {customerList.map((entry, i) => {
                    const cfg = STATUS_CONFIG[entry.status]
                    const isActive = entry.status === "in-progress"
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className={[
                          "grid grid-cols-[2.5rem_1fr_4.5rem_2rem] items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                          isActive
                            ? "bg-emerald-50/60 border-emerald-200"
                            : "bg-white border-slate-200",
                        ].join(" ")}
                      >
                        <span className={`text-xl font-black tabular-nums ${isActive ? "text-emerald-700" : "text-slate-900"}`}>
                          {entry.queueNumber}
                        </span>
                        <div className="min-w-0">
                          <p className={`font-mono font-semibold text-sm truncate ${isActive ? "text-emerald-800" : "text-slate-800"}`}>
                            Bill {entry.billNumber}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
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
                          className="flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                          title="Print ticket"
                        >
                          <Printer className="size-4" />
                        </button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

export default function BusinessPage() {
  return (
    <Suspense fallback={null}>
      <BusinessPageInner />
    </Suspense>
  )
}
