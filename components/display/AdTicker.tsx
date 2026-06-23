"use client"

import { motion } from "framer-motion"

interface AdTickerProps {
  bg?: string
  border?: string
  chipBg?: string
  chipText?: string
  textColor?: string
}

const ITEMS = [
  "Thank you for dining with us today",
  "Scan the QR code at your table to join the queue digitally",
  "Ask our team about today's chef specials",
  "Gift cards available at the front counter",
  "Follow us on social media for exclusive offers",
  "Happy Hour every weekday 4 – 7 PM",
  "Private dining available for groups of 10 or more",
  "We appreciate your patience — your table will be ready soon",
  "Earn reward points with every visit — ask staff for details",
]

const SEP = "   ·   "
const FULL = ITEMS.join(SEP)

export function AdTicker({
  bg = "#0F172A",
  border = "#1E293B",
  chipBg = "#F59E0B",
  chipText = "#0F172A",
  textColor = "#CBD5E1",
}: AdTickerProps) {
  return (
    <div
      className="relative overflow-hidden shrink-0 flex items-center"
      style={{
        height: "clamp(44px, 5vh, 60px)",
        backgroundColor: bg,
        borderTop: `1px solid ${border}`,
      }}
    >
      {/* Label chip */}
      <div
        className="shrink-0 z-10 flex items-center justify-center self-stretch"
        style={{
          width: "clamp(60px, 6vw, 90px)",
          backgroundColor: chipBg,
        }}
      >
        <span
          className="font-black uppercase tracking-[0.3em] whitespace-nowrap"
          style={{ fontSize: "clamp(0.5rem, 0.75vw, 0.7rem)", color: chipText }}
        >
          News
        </span>
      </div>

      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex whitespace-nowrap items-center"
          animate={{ x: "-50%" }}
          transition={{ repeat: Infinity, duration: 50, ease: "linear" }}
        >
          <span
            className="font-medium pr-24"
            style={{ fontSize: "clamp(0.75rem, 1.1vw, 1rem)", color: textColor }}
          >
            {FULL}
            {SEP}
            {FULL}
          </span>
          <span
            className="font-medium pr-24"
            style={{ fontSize: "clamp(0.75rem, 1.1vw, 1rem)", color: textColor }}
          >
            {FULL}
            {SEP}
            {FULL}
          </span>
        </motion.div>
      </div>
    </div>
  )
}
