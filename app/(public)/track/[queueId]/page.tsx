"use client"

import { use, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, MessageCircle, MapPin, LogOut, Clock, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { QueueTypeBadge } from "@/components/shared/QueueTypeBadge"
import { ServiceTypeBadge } from "@/components/shared/ServiceTypeBadge"
import { WaitTimeline } from "@/components/tracking/WaitTimeline"
import { StatusMessage } from "@/components/tracking/StatusMessage"
import { CompletionScreen } from "@/components/tracking/CompletionScreen"
import { LeaveQueueDialog } from "@/components/tracking/LeaveQueueDialog"
import { useQueueStore } from "@/store/queueStore"
import { useSettingsStore } from "@/store/settingsStore"
import { estimateWait, formatDuration, formatRelativeTime } from "@/lib/queueUtils"
import { flipNumber } from "@/lib/animations"
import { toast } from "sonner"

export default function TrackPage({
  params,
}: {
  params: Promise<{ queueId: string }>
}) {
  const { queueId } = use(params)
  const { getEntryByToken, getPositionInQueue, cancelEntry, currentServingNumber } = useQueueStore()
  const { businessName, phone, address, hours } = useSettingsStore()

  const entry = getEntryByToken(queueId)
  const position = entry ? getPositionInQueue(entry.queueNumber) : 0
  const estimatedWaitMins = estimateWait(position)

  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [leaveOpen, setLeaveOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setLastUpdated(new Date()), 5000)
    return () => clearInterval(timer)
  }, [])

  const handleLeave = () => {
    if (!entry) return
    cancelEntry(entry.queueNumber)
    toast.info("You have left the queue.")
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center max-w-sm">
          <p className="text-5xl font-black text-gray-200 mb-4">#?</p>
          <h1 className="text-xl font-bold text-gray-900">Queue Not Found</h1>
          <p className="text-sm text-gray-500 mt-2">This tracking link is invalid or has expired.</p>
          <Button asChild className="mt-6 w-full">
            <Link href="/join">Join a New Queue</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (entry.status === "completed") {
    return <CompletionScreen customerName={entry.name} queueNumber={entry.queueNumber} />
  }

  if (entry.status === "cancelled") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center max-w-sm">
          <div className="size-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <LogOut className="size-6 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">You Left the Queue</h1>
          <p className="text-gray-500 text-sm mt-2">Queue #{entry.queueNumber} was cancelled.</p>
          <Button asChild className="mt-6 w-full">
            <Link href="/join">Rejoin Queue</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isYourTurn = entry.status === "in-progress"

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-gray-900 truncate">{businessName}</span>
            <span className="text-gray-300 shrink-0">/</span>
            <span className="text-xs text-gray-400 shrink-0">Queue Tracker</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-4">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline">
              {formatRelativeTime(lastUpdated.toISOString())}
            </span>
          </div>
        </div>
      </header>

      {/* Your turn banner */}
      <AnimatePresence>
        {isYourTurn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-emerald-500 overflow-hidden"
          >
            <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-center gap-3">
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="size-2 rounded-full bg-white shrink-0"
              />
              <p className="text-white font-semibold text-sm sm:text-base">
                It&apos;s your turn! Please proceed to the counter.
              </p>
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, delay: 0.7 }}
                className="size-2 rounded-full bg-white shrink-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── PRIMARY COLUMN ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Main ticket card */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Now Serving */}
              <div className="text-center px-8 pt-8 pb-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">
                  Now Serving
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentServingNumber}
                    variants={flipNumber}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="text-8xl sm:text-9xl font-black text-gray-900 leading-none tabular-nums"
                  >
                    {currentServingNumber}
                  </motion.p>
                </AnimatePresence>
                {isYourTurn && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-600 font-semibold text-sm mt-3"
                  >
                    That&apos;s you — head to the counter!
                  </motion.p>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 border-t border-gray-100">
                <div className="py-5 px-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Your Number
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={entry.queueNumber}
                      variants={flipNumber}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-3xl sm:text-4xl font-black text-gray-900 tabular-nums leading-none"
                    >
                      #{entry.queueNumber}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className="py-5 px-4 text-center border-x border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Ahead
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums">
                    {position}
                  </p>
                </div>
                <div className="py-5 px-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Est. Wait
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums">
                    {estimatedWaitMins}
                    <span className="text-sm font-semibold text-gray-400 ml-0.5">m</span>
                  </p>
                </div>
              </div>

              {/* Progress + badges */}
              <div className="px-6 pb-6 pt-1 space-y-3 border-t border-gray-100">
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-4">
                  <motion.div
                    className="h-full rounded-full bg-gray-800"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, 100 - position * 10)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={entry.status} pulse />
                    <QueueTypeBadge type={entry.type} />
                    <ServiceTypeBadge service={entry.service} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Users className="size-3" />
                    <span>{position} ahead</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Status message */}
            {entry.status === "waiting" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <StatusMessage position={position} />
              </motion.div>
            )}
          </div>

          {/* ── SECONDARY COLUMN ── */}
          <div className="space-y-4">

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white border border-gray-200 rounded-2xl p-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">
                Progress
              </p>
              <WaitTimeline status={entry.status} />
            </motion.div>

            {/* Contact */}
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Contact
                </p>
                <p className="text-sm font-semibold text-gray-900">{businessName}</p>
                {address && <p className="text-xs text-gray-500 mt-0.5">{address}</p>}
                {hours && <p className="text-xs text-gray-500">{hours}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { href: `tel:${phone}`, icon: Phone, label: "Call" },
                  {
                    href: `https://wa.me/${phone.replace(/\D/g, "")}`,
                    icon: MessageCircle,
                    label: "WhatsApp",
                    external: true,
                  },
                  {
                    href: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
                    icon: MapPin,
                    label: "Directions",
                    external: true,
                  },
                ].map(({ href, icon: Icon, label, external }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    className="flex-col h-14 gap-1 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
                    asChild
                  >
                    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      <Icon className="size-4" />
                      <span className="text-[10px] font-semibold">{label}</span>
                    </a>
                  </Button>
                ))}
              </div>
            </motion.div>

            {/* Leave */}
            {entry.status === "waiting" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl h-11"
                  onClick={() => setLeaveOpen(true)}
                >
                  <LogOut className="size-4" />
                  Leave Queue
                </Button>
              </motion.div>
            )}
          </div>

        </div>
      </main>

      <LeaveQueueDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        queueNumber={entry.queueNumber}
      />
    </div>
  )
}
