"use client"

import { use, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, MessageCircle, MapPin, LogOut, Clock, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { QueueTypeBadge } from "@/components/shared/QueueTypeBadge"
import { ServiceTypeBadge } from "@/components/shared/ServiceTypeBadge"
import { CircularProgress } from "@/components/tracking/CircularProgress"
import { WaitTimeline } from "@/components/tracking/WaitTimeline"
import { StatusMessage } from "@/components/tracking/StatusMessage"
import { CompletionScreen } from "@/components/tracking/CompletionScreen"
import { LeaveQueueDialog } from "@/components/tracking/LeaveQueueDialog"
import { useQueueStore } from "@/store/queueStore"
import { useSettingsStore } from "@/store/settingsStore"
import { estimateWait, formatDuration, formatRelativeTime } from "@/lib/queueUtils"
import { flipNumber, staggerContainer, staggerItem } from "@/lib/animations"
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
    const timer = setInterval(() => {
      setLastUpdated(new Date())
    }, 5000)
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
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900">Queue Not Found</h1>
          <p className="text-sm text-gray-500 mt-2">
            This tracking link is invalid or has expired.
          </p>
          <Button asChild className="mt-6 bg-primary hover:bg-primary/90">
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
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900">You Left the Queue</h1>
          <p className="text-gray-500 text-sm mt-2">
            Queue #{entry.queueNumber} was cancelled.
          </p>
          <Button asChild className="mt-6 bg-primary hover:bg-primary/90">
            <Link href="/join">Rejoin Queue</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-sm px-4 pt-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1 className="text-xl font-bold text-gray-900">{businessName}</h1>
          <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide">Queue Tracker</p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {/* Queue number card */}
          <motion.div
            variants={staggerItem}
            className="bg-white border border-gray-200 rounded-md p-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <StatusBadge status={entry.status} pulse />
              <QueueTypeBadge type={entry.type} />
            </div>

            <p className="text-xs text-gray-400 uppercase tracking-wide">Your Queue Number</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={entry.queueNumber}
                variants={flipNumber}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-8xl font-black text-gray-900 leading-none my-3"
              >
                #{entry.queueNumber}
              </motion.p>
            </AnimatePresence>

            <ServiceTypeBadge service={entry.service} />
          </motion.div>

          {/* Now serving / your turn */}
          {entry.status === "in-progress" ? (
            <motion.div
              variants={staggerItem}
              className="bg-emerald-50 border border-emerald-200 rounded-md p-6 text-center"
            >
              <p className="text-2xl font-black text-emerald-700">It's Your Turn!</p>
              <p className="text-gray-500 text-sm mt-1">
                Please proceed to the counter now.
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerItem}
              className="bg-white border border-gray-200 rounded-md p-5"
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-black text-gray-900">{currentServingNumber}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Now Serving</p>
                </div>
                <div className="flex flex-col items-center">
                  <CircularProgress value={position} max={position + 3} size={72} strokeWidth={6} />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900">{estimatedWaitMins}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Est. Mins</p>
                </div>
              </div>

              {position > 0 && (
                <div className="mt-4 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gray-800"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(5, 100 - position * 10)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <Users className="size-3" />
                  <span>{position} {position === 1 ? "person" : "people"} ahead</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>{formatDuration(estimatedWaitMins)} est.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Status message */}
          {entry.status === "waiting" && (
            <motion.div variants={staggerItem}>
              <StatusMessage position={position} />
            </motion.div>
          )}

          {/* Timeline */}
          <motion.div
            variants={staggerItem}
            className="bg-white border border-gray-200 rounded-md p-5"
          >
            <h3 className="text-sm font-semibold mb-4">Queue Progress</h3>
            <WaitTimeline status={entry.status} />
          </motion.div>

          {/* Last updated */}
          <motion.div
            variants={staggerItem}
            className="text-center text-xs text-gray-400"
          >
            Last updated: {formatRelativeTime(lastUpdated.toISOString())}
          </motion.div>

          {/* Help section */}
          <motion.div
            variants={staggerItem}
            className="bg-white border border-gray-200 rounded-md p-5 space-y-4"
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Need Assistance?</h3>
              <p className="text-xs text-gray-400 mt-0.5">{businessName}</p>
              <p className="text-xs text-gray-400">{address}</p>
              <p className="text-xs text-gray-400">{hours}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="flex-col h-12 gap-1 text-[10px]" asChild>
                <a href={`tel:${phone}`}>
                  <Phone className="size-3.5" />
                  Call
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-col h-12 gap-1 text-[10px]" asChild>
                <a
                  href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-3.5" />
                  WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-col h-12 gap-1 text-[10px]" asChild>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="size-3.5" />
                  Directions
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Leave queue */}
          {entry.status === "waiting" && (
            <motion.div variants={staggerItem}>
              <Button
                variant="ghost"
                className="w-full gap-2 text-gray-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => setLeaveOpen(true)}
              >
                <LogOut className="size-4" />
                Leave Queue
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>

      <LeaveQueueDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        queueNumber={entry.queueNumber}
      />
    </div>
  )
}
