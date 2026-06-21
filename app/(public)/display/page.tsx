"use client"

import { useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { DisplayClock } from "@/components/display/DisplayClock"
import { useQueueStore } from "@/store/queueStore"
import { useSettingsStore } from "@/store/settingsStore"
import { flipNumber } from "@/lib/animations"

export default function DisplayPage() {
  const { entries, currentServingNumber } = useQueueStore()
  const { businessName } = useSettingsStore()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const nextWaiting = entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.queueNumber - b.queueNumber)
    .slice(0, 4)

  const recentCompleted = entries
    .filter((e) => e.status === "completed")
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
    .slice(0, 4)

  const currentEntry = entries.find(
    (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
  )

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col select-none">

      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-10 py-5 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{businessName}</h1>
          <p className="text-sm text-gray-400 mt-0.5 uppercase tracking-widest font-medium">Restaurant Queue</p>
        </div>
        <div className="flex items-center gap-6">
          <DisplayClock />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-gray-700 text-xs uppercase tracking-wide"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">

        {/* Left: Now Serving */}
        <div className="flex w-3/5 flex-col items-center justify-center border-r border-gray-200 p-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-gray-400 mb-10">
            Now Serving
          </p>

          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentServingNumber}
                variants={flipNumber}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <p className="font-black leading-none text-gray-900"
                   style={{ fontSize: "clamp(8rem, 22vw, 20rem)", lineHeight: 1 }}>
                  {currentServingNumber}
                </p>
              </motion.div>
            </AnimatePresence>

            {currentEntry && (
              <motion.div
                key={currentEntry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <p className="text-2xl font-mono font-semibold text-gray-500">
                  Bill {currentEntry.billNumber}
                </p>
              </motion.div>
            )}

            {!currentEntry && (
              <p className="mt-8 text-xl text-gray-300">Waiting for next customer</p>
            )}
          </div>
        </div>

        {/* Right: Next up + Completed */}
        <div className="flex w-2/5 flex-col overflow-hidden bg-gray-50">

          <div className="flex-1 min-h-0 flex flex-col p-6 lg:p-8">
            <p className="shrink-0 text-xs font-bold uppercase tracking-[0.4em] text-gray-400 mb-6">
              Next in Line
            </p>

            <div className="flex-1 min-h-0 overflow-hidden space-y-2">
              <AnimatePresence>
                {nextWaiting.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-5 bg-white border border-gray-200 rounded-md px-5 py-4"
                  >
                    <p className="text-3xl font-black text-gray-900 tabular-nums w-14 shrink-0">
                      {entry.queueNumber}
                    </p>
                    <p className="text-lg font-mono font-semibold text-gray-600 truncate">
                      Bill {entry.billNumber}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {nextWaiting.length === 0 && (
                <p className="text-base text-gray-400 text-center py-12">Queue is empty</p>
              )}
            </div>
          </div>

          {recentCompleted.length > 0 && (
            <div className="shrink-0 border-t border-gray-200 px-6 py-5 lg:px-8 lg:py-6 bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.4em] text-gray-400 mb-3">
                Recently Served
              </p>
              <div className="grid grid-cols-2 gap-2">
                <AnimatePresence>
                  {recentCompleted.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5"
                    >
                      <p className="text-xl font-black text-gray-400 tabular-nums shrink-0 w-8">
                        {entry.queueNumber}
                      </p>
                      <p className="text-sm font-mono text-gray-500 truncate">
                        {entry.billNumber}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
