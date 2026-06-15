"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useQueueStore } from "@/store/queueStore"
import { flipNumber } from "@/lib/animations"
import { formatRelativeTime } from "@/lib/queueUtils"
import { QueueTypeBadge } from "@/components/shared/QueueTypeBadge"
import { ServiceTypeBadge } from "@/components/shared/ServiceTypeBadge"
import { toast } from "sonner"

export function CurrentServingCard() {
  const { currentServingNumber, entries, callNext, callPrevious, completeCurrentEntry } = useQueueStore()

  const currentEntry = entries.find(
    (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
  )

  const waitingCount = entries.filter((e) => e.status === "waiting").length

  const handleComplete = () => {
    completeCurrentEntry()
    toast.success(`Queue #${currentServingNumber} completed!`, {
      description: "Next customer has been called.",
    })
  }

  const handleNext = () => {
    callNext()
    toast.info(`Calling Queue #${currentServingNumber + 1}`)
  }

  const handlePrev = () => {
    callPrevious()
    toast.info("Returned to previous customer")
  }

  return (
    <div className="bg-white border border-border rounded-md p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currently Serving</p>
        <span className="text-xs text-muted-foreground">{waitingCount} in queue</span>
      </div>

      <div className="flex items-center justify-center py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentServingNumber}
            variants={flipNumber}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-center"
          >
            <div className="text-7xl font-black tracking-tight leading-none text-gray-900">
              #{currentServingNumber}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {currentEntry && (
        <motion.div
          key={currentEntry.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 mb-4 rounded-sm bg-muted/50 p-3 space-y-2 border border-border"
        >
          <p className="font-semibold text-sm">{currentEntry.name}</p>
          <div className="flex flex-wrap gap-1.5">
            <ServiceTypeBadge service={currentEntry.service} />
            <QueueTypeBadge type={currentEntry.type} />
          </div>
          {currentEntry.startedAt && (
            <p className="text-xs text-muted-foreground">
              Started {formatRelativeTime(currentEntry.startedAt)}
            </p>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={handlePrev}>
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={handleNext}>
          Next
        </Button>
        <Button
          size="sm"
          onClick={handleComplete}
          className="col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Mark Completed
        </Button>
      </div>
    </div>
  )
}
