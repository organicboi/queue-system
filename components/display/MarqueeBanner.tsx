"use client"

import { motion } from "framer-motion"

const messages = [
  "Thank you for your patience.",
  "Please have your documents ready.",
  "We appreciate your business.",
  "Queue numbers are assigned at check-in.",
  "Our team is working to serve you as quickly as possible.",
]

export function MarqueeBanner() {
  const text = messages.join("   •   ")

  return (
    <div className="overflow-hidden border-t border-gray-200 bg-gray-50 py-3 shrink-0">
      <div className="flex">
        <motion.div
          className="flex shrink-0 whitespace-nowrap"
          animate={{ x: "-50%" }}
          transition={{
            repeat: Infinity,
            duration: 30,
            ease: "linear",
          }}
        >
          <span className="text-sm text-gray-500 pr-8">{text}</span>
          <span className="text-sm text-gray-500 pr-8">{text}</span>
        </motion.div>
      </div>
    </div>
  )
}
