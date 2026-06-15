"use client"

import { motion } from "framer-motion"
import { Phone } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settingsStore"
import { successBounce, staggerContainer, staggerItem } from "@/lib/animations"

interface CompletionScreenProps {
  customerName: string
  queueNumber: number
}

export function CompletionScreen({ customerName, queueNumber }: CompletionScreenProps) {
  const { businessName, phone } = useSettingsStore()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="bg-white border border-gray-200 rounded-md p-8 text-center space-y-5 w-full max-w-sm"
      >
        <motion.div variants={successBounce}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <span className="text-emerald-600 text-4xl font-bold">✓</span>
          </div>
        </motion.div>

        <motion.div variants={staggerItem}>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Service Complete</p>
          <h1 className="text-2xl font-black mt-1 text-gray-900">Thank you, {customerName}!</h1>
          <p className="text-gray-500 text-sm mt-1">
            Your service is ready.
          </p>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="rounded-sm bg-emerald-50 border border-emerald-200 py-4 px-6"
        >
          <p className="text-xs text-gray-400">Queue Number</p>
          <p className="text-4xl font-black text-emerald-700">#{queueNumber}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Completed</p>
        </motion.div>

        <motion.div variants={staggerItem} className="space-y-2">
          <Button asChild className="w-full gap-2 bg-primary hover:bg-primary/90">
            <a href={`tel:${phone}`}>
              <Phone className="size-4" />
              Contact {businessName}
            </a>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
