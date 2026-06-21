"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  PlusCircle, Radio, Users, ArrowLeft, ArrowRight,
  CheckCircle, Printer, Search, X, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueueStore } from "@/store/queueStore"
import { useSettingsStore } from "@/store/settingsStore"
import { toast } from "sonner"
import { formatTime, formatRelativeTime } from "@/lib/queueUtils"
import type { QueueEntry } from "@/lib/types"
import { flipNumber } from "@/lib/animations"

type Tab = "add" | "serving" | "customers"
type AddStep = "entry" | "success"

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "add", label: "Add Customer", Icon: PlusCircle },
  { id: "serving", label: "Serving", Icon: Radio },
  { id: "customers", label: "Customers", Icon: Users },
]

const STATUS_STYLES: Record<string, string> = {
  waiting: "bg-blue-50 text-blue-700 border border-blue-200",
  "in-progress": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  completed: "bg-gray-100 text-gray-500 border border-gray-200",
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  "in-progress": "Serving",
  completed: "Done",
}

export default function BusinessPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("add")

  // Add customer
  const [addStep, setAddStep] = useState<AddStep>("entry")
  const [billNumber, setBillNumber] = useState("")
  const [createdEntry, setCreatedEntry] = useState<QueueEntry | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Currently Serving — integrated search
  const [csQuery, setCsQuery] = useState("")
  const [csSelectedId, setCsSelectedId] = useState<string | null>(null)

  // Print
  const [printEntry, setPrintEntry] = useState<QueueEntry | null>(null)

  const {
    entries, currentServingNumber, callNext, callPrevious,
    completeCurrentEntry, addEntry, markEntryCompleted,
  } = useQueueStore()
  const { businessName } = useSettingsStore()

  const currentEntry = entries.find(
    (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
  )
  const waitingCount = entries.filter((e) => e.status === "waiting").length

  // Live-looked-up selected entry
  const csSearchedEntry = csSelectedId
    ? entries.find((e) => e.id === csSelectedId) ?? null
    : null

  // What the CS card displays — searched entry overrides current
  const displayEntry = csSearchedEntry ?? currentEntry

  // Show results list when typing and nothing selected yet
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

  // Auto-focus bill input when on Add tab
  useEffect(() => {
    if (tab === "add" && addStep === "entry") {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [tab, addStep])

  // Print side-effects
  useEffect(() => {
    if (!printEntry) return
    const timer = setTimeout(() => window.print(), 80)
    return () => clearTimeout(timer)
  }, [printEntry])

  useEffect(() => {
    const handler = () => setPrintEntry(null)
    window.addEventListener("afterprint", handler)
    return () => window.removeEventListener("afterprint", handler)
  }, [])

  // Handlers
  const handleAddSubmit = () => {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    const entry = addEntry(trimmed)
    setCreatedEntry(entry)
    setAddStep("success")
    toast.success(`Queue #${entry.queueNumber} — Bill ${entry.billNumber}`)
  }

  const handleAddAnother = () => {
    setBillNumber("")
    setCreatedEntry(null)
    setAddStep("entry")
  }

  const handleComplete = () => {
    completeCurrentEntry()
    toast.success(`Queue #${currentServingNumber} completed`)
  }

  const handleCompleteDisplayed = () => {
    if (!displayEntry) return
    if (csSelectedId) {
      markEntryCompleted(displayEntry.queueNumber)
      toast.success(`Queue #${displayEntry.queueNumber} marked as completed`)
      setCsSelectedId(null)
      setCsQuery("")
    } else {
      handleComplete()
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
      {/* Print-only receipt */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #biz-print { display: flex !important; }
        }
      `}</style>

      <div
        id="biz-print"
        style={{ display: "none" }}
        className="flex-col items-center justify-center p-10 font-mono text-black"
      >
        {printEntry && (
          <>
            <p className="text-lg font-bold text-center">{businessName}</p>
            <p className="text-xs text-center text-gray-500 mt-0.5 mb-6 uppercase tracking-widest">Queue Ticket</p>
            <div className="border-t border-dashed border-gray-400 w-full mb-6" />
            <p className="text-xs text-center text-gray-500 uppercase tracking-widest mb-1">Queue Number</p>
            <p className="text-8xl font-black text-center leading-none mb-4">#{printEntry.queueNumber}</p>
            <p className="text-lg font-semibold text-center">Bill {printEntry.billNumber}</p>
            <p className="text-xs text-center text-gray-400 mt-2">{formatTime(printEntry.joinedAt)}</p>
            <div className="border-t border-dashed border-gray-400 w-full mt-6 mb-4" />
            <p className="text-xs text-center text-gray-400">Thank you for your patience</p>
          </>
        )}
      </div>

      {/* Main screen */}
      <div className="no-print flex flex-col h-full">

        {/* Header */}
        <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900 text-sm truncate">{businessName}</span>
            <span className="text-[10px] uppercase tracking-widest font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Business Mode
            </span>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit
          </button>
        </header>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-border bg-white">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "relative flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="size-4.5" />
              <span>{label}</span>
              {tab === id && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── ADD CUSTOMER TAB ── */}
            {tab === "add" && (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start"
              >

                {/* ── Quick Entry ── */}
                <div className="rounded-xl border border-border bg-white p-5">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-4">
                    Quick Entry
                  </p>
                  <AnimatePresence mode="wait">
                    {addStep === "entry" ? (
                      <motion.div
                        key="entry"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.12 }}
                        className="space-y-4"
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          placeholder="Bill number…"
                          value={billNumber}
                          onChange={(e) => setBillNumber(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                          className="w-full rounded-md border border-input bg-background px-4 py-4 text-center text-3xl font-bold tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Button
                          onClick={handleAddSubmit}
                          disabled={!billNumber.trim()}
                          className="w-full h-12 text-base bg-primary hover:bg-primary/90"
                        >
                          Generate Queue Number
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4 text-center"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                          <CheckCircle className="size-5 text-emerald-600" />
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 py-6 px-4 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Queue Number</p>
                          <p className="text-6xl font-black text-gray-900 tabular-nums leading-none">
                            #{createdEntry?.queueNumber}
                          </p>
                          <p className="text-sm font-mono text-muted-foreground mt-1">
                            Bill {createdEntry?.billNumber}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={handleAddAnother}>
                            Add Another
                          </Button>
                          {createdEntry && (
                            <Button
                              variant="outline"
                              className="flex-none px-3"
                              onClick={() => handlePrint(createdEntry)}
                              title="Print ticket"
                            >
                              <Printer className="size-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Currently Serving (with integrated search) ── */}
                <div className="rounded-xl border border-border bg-white overflow-hidden flex flex-col">

                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                      Currently Serving
                    </p>
                    <AnimatePresence>
                      {csSelectedId && (
                        <motion.button
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 6 }}
                          transition={{ duration: 0.12 }}
                          onClick={handleCsBack}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="size-3" />
                          Back to current
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Search bar */}
                  <div className="px-5 pb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Find by queue # or bill number…"
                        value={csQuery}
                        onChange={(e) => {
                          setCsQuery(e.target.value)
                          setCsSelectedId(null)
                        }}
                        className="w-full rounded-lg border border-input bg-muted/40 pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors placeholder:text-muted-foreground/60"
                      />
                      {csQuery && (
                        <button
                          onClick={() => { setCsQuery(""); setCsSelectedId(null) }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic content area */}
                  <div className="flex-1 px-5">
                    <AnimatePresence mode="wait">

                      {/* Search results list */}
                      {isSearchMode ? (
                        <motion.div
                          key="results"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12 }}
                        >
                          {csResults.length === 0 ? (
                            <div className="py-10 text-center">
                              <p className="text-sm text-muted-foreground">No matching entries</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 pb-2">
                              {csResults.map((entry) => (
                                <button
                                  key={entry.id}
                                  onClick={() => handleCsSelect(entry)}
                                  className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 px-3 py-2.5 text-left transition-all group"
                                >
                                  <span className="text-xl font-black text-gray-900 tabular-nums w-9 shrink-0 text-center">
                                    {entry.queueNumber}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-mono font-semibold text-gray-800 truncate">
                                      Bill {entry.billNumber}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {formatTime(entry.joinedAt)}
                                    </p>
                                  </div>
                                  <span
                                    className={[
                                      "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
                                      STATUS_STYLES[entry.status] ?? "bg-gray-100 text-gray-500",
                                    ].join(" ")}
                                  >
                                    {STATUS_LABEL[entry.status] ?? entry.status}
                                  </span>
                                  <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary/60 shrink-0 transition-colors" />
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ) : (

                        /* Big number display — current or searched */
                        <motion.div
                          key={displayEntry?.id ?? "empty"}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.14 }}
                          className="flex flex-col items-center justify-center text-center py-5"
                        >
                          {/* Searched-entry indicator */}
                          <AnimatePresence>
                            {csSelectedId && displayEntry && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-3"
                              >
                                <span
                                  className={[
                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                    STATUS_STYLES[displayEntry.status] ?? "bg-gray-100 text-gray-500",
                                  ].join(" ")}
                                >
                                  {STATUS_LABEL[displayEntry.status] ?? displayEntry.status}
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence mode="wait">
                            <motion.p
                              key={displayEntry?.queueNumber ?? currentServingNumber}
                              variants={flipNumber}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              className="text-7xl font-black text-gray-900 tabular-nums leading-none"
                            >
                              #{displayEntry?.queueNumber ?? currentServingNumber}
                            </motion.p>
                          </AnimatePresence>

                          {displayEntry ? (
                            <div className="mt-3 space-y-0.5">
                              <p className="text-base font-mono font-semibold text-gray-700">
                                Bill {displayEntry.billNumber}
                              </p>
                              {displayEntry.startedAt && displayEntry.status === "in-progress" && (
                                <p className="text-xs text-muted-foreground">
                                  Started {formatRelativeTime(displayEntry.startedAt)}
                                </p>
                              )}
                              {displayEntry.completedAt && displayEntry.status === "completed" && (
                                <p className="text-xs text-muted-foreground">
                                  Completed {formatRelativeTime(displayEntry.completedAt)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-3">No active entry</p>
                          )}

                          {!csSelectedId && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4">
                              <span className="size-1.5 rounded-full bg-amber-400" />
                              {waitingCount} waiting
                            </div>
                          )}
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                  {/* Action buttons — hidden while showing results list */}
                  <AnimatePresence>
                    {!isSearchMode && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="px-5 pb-5 pt-2 space-y-2"
                      >
                        {/* Prev / Next — only when showing current serving */}
                        {!csSelectedId && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="h-10 gap-1.5 text-xs"
                              onClick={() => callPrevious()}
                            >
                              <ArrowLeft className="size-3.5" /> Prev
                            </Button>
                            <Button
                              variant="outline"
                              className="h-10 gap-1.5 text-xs"
                              onClick={() => callNext()}
                            >
                              Next <ArrowRight className="size-3.5" />
                            </Button>
                          </div>
                        )}

                        {/* Print + action */}
                        {displayEntry ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="h-11 gap-2 text-sm"
                              onClick={() => handlePrint(displayEntry)}
                            >
                              <Printer className="size-4" />
                              Print
                            </Button>

                            {displayEntry.status === "completed" ? (
                              <div className="flex items-center justify-center gap-1.5 rounded-md bg-muted/50 text-sm text-emerald-600 font-medium">
                                <CheckCircle className="size-4" />
                                Done
                              </div>
                            ) : displayEntry.status === "cancelled" ? (
                              <div className="flex items-center justify-center rounded-md bg-muted/50 text-sm text-muted-foreground font-medium">
                                Cancelled
                              </div>
                            ) : (
                              <Button
                                className="h-11 text-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={handleCompleteDisplayed}
                              >
                                <CheckCircle className="size-4" />
                                {csSelectedId ? "Complete" : "Mark Done"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          /* No entry at all */
                          <div className="h-11 flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                            No entry to act on
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            )}

            {/* ── SERVING TAB ── */}
            {tab === "serving" && (
              <motion.div
                key="serving"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="flex min-h-full items-center justify-center p-6"
              >
                <div className="w-full max-w-sm space-y-6">
                  <div className="rounded-xl border border-border bg-white p-8 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-4">
                      Currently Serving
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={currentServingNumber}
                        variants={flipNumber}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="text-8xl font-black text-gray-900 tabular-nums leading-none"
                      >
                        #{currentServingNumber}
                      </motion.p>
                    </AnimatePresence>
                    {currentEntry ? (
                      <motion.div
                        key={currentEntry.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 space-y-0.5"
                      >
                        <p className="text-base font-mono font-semibold text-gray-700">
                          Bill {currentEntry.billNumber}
                        </p>
                        {currentEntry.startedAt && (
                          <p className="text-xs text-muted-foreground">
                            Started {formatRelativeTime(currentEntry.startedAt)}
                          </p>
                        )}
                      </motion.div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-4">No active entry</p>
                    )}
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      {waitingCount} waiting
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-12 gap-2" onClick={() => callPrevious()}>
                      <ArrowLeft className="size-4" /> Prev
                    </Button>
                    <Button variant="outline" className="h-12 gap-2" onClick={() => callNext()}>
                      Next <ArrowRight className="size-4" />
                    </Button>
                  </div>

                  <Button
                    className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    onClick={handleComplete}
                  >
                    <CheckCircle className="size-4" />
                    Mark Completed
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── CUSTOMERS TAB ── */}
            {tab === "customers" && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="p-4 space-y-2"
              >
                <div className="grid grid-cols-[3rem_1fr_5rem_2rem] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  <span>#</span>
                  <span>Bill</span>
                  <span>Status</span>
                  <span />
                </div>

                {customerList.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No customers yet
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {customerList.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="grid grid-cols-[3rem_1fr_5rem_2rem] items-center gap-3 rounded-md border border-border bg-white px-3 py-3"
                    >
                      <span className="text-xl font-black text-gray-900 tabular-nums">
                        {entry.queueNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-sm text-gray-800 truncate">
                          Bill {entry.billNumber}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatTime(entry.joinedAt)}
                        </p>
                      </div>
                      <span
                        className={[
                          "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          STATUS_STYLES[entry.status] ?? "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >
                        {STATUS_LABEL[entry.status] ?? entry.status}
                      </span>
                      <button
                        onClick={() => handlePrint(entry)}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Print ticket"
                      >
                        <Printer className="size-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
