"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { DisplayClock } from "@/components/display/DisplayClock"
import { useSettingsStore } from "@/store/settingsStore"
import { ALL_THEMES, THEME_ROUTES } from "@/components/display/displayThemes"
import type { TVTheme } from "@/components/display/displayThemes"

function ThemePreview({ theme }: { theme: TVTheme }) {
  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ aspectRatio: "16/9", border: `1px solid ${theme.navBorder}` }}>
      {/* Nav strip */}
      <div
        className="flex items-center justify-between px-3"
        style={{ height: "14%", backgroundColor: theme.navBg, borderBottom: `1px solid ${theme.navBorder}` }}
      >
        <div
          className="rounded font-black"
          style={{ width: "30%", height: "40%", backgroundColor: theme.navTitle, opacity: 0.8, borderRadius: 2 }}
        />
        <div
          className="rounded font-mono"
          style={{ width: "18%", height: "35%", backgroundColor: theme.navTitle, opacity: 0.4, borderRadius: 2 }}
        />
      </div>

      {/* Content */}
      <div className="flex" style={{ height: "73%" }}>
        {/* Left 40% */}
        <div
          className="flex flex-col"
          style={{ width: "40%", backgroundColor: theme.servingBg, borderRight: `1px solid ${theme.sectionBorder}` }}
        >
          {/* Now serving */}
          <div
            className="flex items-center justify-center"
            style={{ flex: 3, borderBottom: `1px solid ${theme.servingBorder}` }}
          >
            <span
              className="font-black tabular-nums"
              style={{ fontSize: "clamp(1.5rem, 3.5vw, 4rem)", color: theme.servingNumber, lineHeight: 1 }}
            >
              3
            </span>
          </div>
          {/* Bottom 2 cols */}
          <div className="flex" style={{ flex: 2 }}>
            <div
              className="flex-1 p-1"
              style={{ backgroundColor: theme.nextBg, borderRight: `1px solid ${theme.sectionBorder}` }}
            >
              {[4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="rounded mb-1"
                  style={{ height: "22%", backgroundColor: theme.rowBg, border: `1px solid ${theme.rowBorder}` }}
                />
              ))}
            </div>
            <div className="flex-1 p-1" style={{ backgroundColor: theme.recentBg }}>
              {[2, 1].map((n) => (
                <div
                  key={n}
                  className="rounded mb-1"
                  style={{ height: "22%", backgroundColor: theme.rowBg, border: `1px solid ${theme.rowBorder}`, opacity: 0.5 }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right 60% — always dark ad panel */}
        <div className="flex items-center justify-center" style={{ flex: 1, backgroundColor: "#0F172A" }}>
          <div className="text-center px-4">
            <div className="rounded-full px-3 py-1 mb-2 inline-block" style={{ backgroundColor: `${theme.tickerChipBg}22`, border: `1px solid ${theme.tickerChipBg}44` }}>
              <span style={{ fontSize: "0.35rem", color: theme.tickerChipBg, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Today's Special
              </span>
            </div>
            <p className="font-black text-white leading-tight" style={{ fontSize: "clamp(0.6rem, 1.2vw, 1.1rem)" }}>
              Grilled Salmon
            </p>
            <p className="font-black" style={{ fontSize: "clamp(0.8rem, 1.6vw, 1.5rem)", color: theme.tickerChipBg }}>
              $24.99
            </p>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div
        className="flex items-center"
        style={{ height: "13%", backgroundColor: theme.tickerBg, borderTop: `1px solid ${theme.tickerBorder}` }}
      >
        <div
          className="flex items-center justify-center self-stretch px-2"
          style={{ backgroundColor: theme.tickerChipBg, minWidth: "12%" }}
        >
          <span style={{ fontSize: "0.35rem", color: theme.tickerChipText, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            News
          </span>
        </div>
        <div className="overflow-hidden flex-1 px-2">
          <div className="rounded" style={{ height: "35%", backgroundColor: theme.tickerText, opacity: 0.3 }} />
        </div>
      </div>
    </div>
  )
}

export default function DisplaySelectorPage() {
  const { businessName, businessType } = useSettingsStore()

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col select-none bg-[#030712]">
      {/* Header */}
      <header className="flex items-center justify-between px-12 shrink-0" style={{ height: "clamp(60px, 7vh, 80px)", borderBottom: "1px solid #0F172A" }}>
        <div>
          <h1 className="font-black tracking-tight text-white leading-none" style={{ fontSize: "clamp(1rem, 1.5vw, 1.5rem)" }}>
            {businessName}
          </h1>
          <p className="uppercase tracking-widest font-semibold mt-1 text-slate-600" style={{ fontSize: "clamp(0.45rem, 0.7vw, 0.65rem)" }}>
            {businessType} Queue
          </p>
        </div>
        <DisplayClock timeColor="#F8FAFC" dateColor="#475569" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center px-12 py-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="font-black uppercase tracking-[0.5em] text-slate-600 mb-3" style={{ fontSize: "clamp(0.5rem, 0.9vw, 0.8rem)" }}>
            Display Settings
          </p>
          <h2 className="font-black text-white leading-none" style={{ fontSize: "clamp(1.8rem, 4vw, 4.5rem)" }}>
            Select a Theme
          </h2>
          <p className="mt-3 text-slate-500" style={{ fontSize: "clamp(0.7rem, 1.2vw, 1.1rem)" }}>
            Choose how your queue display screen looks for customers
          </p>
        </motion.div>

        {/* Theme cards */}
        <div className="grid grid-cols-4 gap-6 w-full max-w-[90vw]">
          {ALL_THEMES.map((theme, i) => (
            <motion.div
              key={theme.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.45 }}
            >
              <Link href={THEME_ROUTES[theme.id]} className="block group">
                <div
                  className="rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl"
                  style={{
                    backgroundColor: "#0B1120",
                    border: "1px solid #1E293B",
                    padding: "clamp(10px, 1.2vw, 16px)",
                  }}
                >
                  {/* Preview */}
                  <ThemePreview theme={theme} />

                  {/* Info */}
                  <div className="mt-4 px-1">
                    <div className="flex items-center justify-between mb-1">
                      <p
                        className="font-black text-white"
                        style={{ fontSize: "clamp(0.85rem, 1.4vw, 1.25rem)" }}
                      >
                        {theme.name}
                      </p>
                      {i === 0 && (
                        <span
                          className="rounded-full font-black uppercase tracking-wider"
                          style={{
                            fontSize: "clamp(0.4rem, 0.6vw, 0.55rem)",
                            padding: "0.25em 0.75em",
                            backgroundColor: "#1E293B",
                            color: "#64748B",
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <p
                      className="text-slate-500 leading-snug"
                      style={{ fontSize: "clamp(0.6rem, 0.95vw, 0.875rem)" }}
                    >
                      {theme.description}
                    </p>

                    {/* Color dots */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="rounded-full size-3" style={{ backgroundColor: theme.servingNumber }} />
                      <div className="rounded-full size-3" style={{ backgroundColor: theme.navTitle, opacity: 0.6 }} />
                      <div className="rounded-full size-3" style={{ backgroundColor: theme.tickerChipBg, opacity: 0.8 }} />
                      <div className="flex-1" />
                      <span
                        className="font-semibold uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors"
                        style={{ fontSize: "clamp(0.4rem, 0.65vw, 0.6rem)" }}
                      >
                        Select →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
