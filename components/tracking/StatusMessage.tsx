"use client"

import { motion, AnimatePresence } from "framer-motion"
import { getSmartStatusMessage } from "@/lib/queueUtils"

interface StatusMessageProps {
  position: number
}

export function StatusMessage({ position }: StatusMessageProps) {
  const message = getSmartStatusMessage(position)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-center"
      >
        <p className="text-sm text-blue-700 font-medium">{message}</p>
      </motion.div>
    </AnimatePresence>
  )
}
