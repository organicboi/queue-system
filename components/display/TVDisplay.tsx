"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { DisplayClock } from "@/components/display/DisplayClock"
import { AdPanel } from "@/components/display/AdPanel"
import { AdTicker } from "@/components/display/AdTicker"
import { useSupabaseQueue } from "@/lib/useSupabaseQueue"
import { useSettingsStore } from "@/store/settingsStore"
import { flipNumber } from "@/lib/animations"
import { supabase } from "@/lib/supabase"
import type { TVTheme } from "@/components/display/displayThemes"

interface CalledInfo {
  queueNumber: number
  billNumber: string
  callCount: number
  key: number
}

export function TVDisplay({ theme }: { theme: TVTheme }) {
  const { entries, currentServingNumber } = useSupabaseQueue()
  const { businessName, businessType } = useSettingsStore()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [calledInfo, setCalledInfo] = useState<CalledInfo | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // In kiosk mode the AndroidTTS bridge is already available — no tap needed
  useEffect(() => {
    if (typeof window !== "undefined" && "AndroidTTS" in window) {
      setAudioReady(true)
    }
  }, [])

  const unlockAudio = useCallback(() => {
    // Create AudioContext during the user gesture so it's allowed to produce sound later
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
      if (Ctx) audioCtxRef.current = new Ctx()
    } catch {}

    // Prime speechSynthesis so it speaks immediately on the first real call
    if ("speechSynthesis" in window) {
      const silent = new SpeechSynthesisUtterance(" ")
      silent.volume = 0
      window.speechSynthesis.speak(silent)
      setTimeout(() => window.speechSynthesis.cancel(), 200)
    }

    setAudioReady(true)
  }, [])

  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.55, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
      osc.start(t)
      osc.stop(t + 1.4)
    } catch {}
  }, [])

  const announce = useCallback((queueNumber: number) => {
    if (typeof window === "undefined") return
    const text = `Token Number ${queueNumber}, please proceed to the counter.`

    // Android WebView kiosk — uses native TTS, no browser restrictions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("AndroidTTS" in window) { ;(window as any).AndroidTTS.speak(text); return }

    // Chime first — works on any browser where AudioContext was unlocked
    playChime()

    // Speech synthesis — desktop Chrome / Android TV Chrome after audio unlock
    if (!("speechSynthesis" in window)) return

    const doSpeak = () => {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 0.82
      utter.pitch = 1.0
      utter.volume = 1.0
      window.speechSynthesis.speak(utter)
    }

    // Voices may not be loaded yet on first render — wait for them
    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak()
    } else {
      const onReady = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onReady)
        doSpeak()
      }
      window.speechSynthesis.addEventListener("voiceschanged", onReady)
    }
  }, [playChime])

  useEffect(() => {
    const ch = supabase
      .channel("queue-display-signals")
      .on("broadcast", { event: "customer-called" }, ({ payload }) => {
        setCalledInfo((prev) => ({
          queueNumber: payload.queueNumber as number,
          billNumber: payload.billNumber as string,
          callCount: payload.callCount as number,
          key: (prev?.key ?? 0) + 1,
        }))
        announce(payload.queueNumber as number)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [announce])

  useEffect(() => {
    if (!calledInfo) return
    const t = setTimeout(() => setCalledInfo(null), 7000)
    return () => clearTimeout(t)
  }, [calledInfo?.key])

  const nextWaiting = entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.queueNumber - b.queueNumber)
    .slice(0, 3)

  const recentCompleted = entries
    .filter((e) => e.status === "completed")
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
    .slice(0, 3)

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
    <div
      className="h-screen w-screen overflow-hidden flex flex-col select-none"
      style={{ backgroundColor: theme.pageBg }}
    >
      {/* Audio unlock overlay — shown on TV/browser until staff taps once */}
      <AnimatePresence>
        {!audioReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
            style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
            onClick={unlockAudio}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") unlockAudio() }}
          >
            <p
              className="font-black text-white text-center"
              style={{ fontSize: "clamp(1.8rem, 4vw, 4rem)", letterSpacing: "-0.02em" }}
            >
              Tap anywhere to enable audio
            </p>
            <p
              className="mt-4 text-slate-400 text-center"
              style={{ fontSize: "clamp(0.9rem, 1.6vw, 1.4rem)" }}
            >
              One-time setup — browsers require a tap before playing sound
            </p>
            <div
              className="mt-10 rounded-full font-black uppercase tracking-widest"
              style={{
                fontSize: "clamp(0.6rem, 1vw, 0.9rem)",
                padding: "0.75em 2.5em",
                backgroundColor: theme.tickerChipBg,
                color: theme.tickerChipText,
              }}
            >
              Enable Audio
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAVBAR ── */}
      <header
        className="flex items-center justify-between shrink-0 px-10"
        style={{
          height: "clamp(60px, 7vh, 88px)",
          backgroundColor: theme.navBg,
          borderBottom: `1px solid ${theme.navBorder}`,
        }}
      >
        <div>
          <h1
            className="font-black tracking-tight leading-none"
            style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.9rem)", color: theme.navTitle }}
          >
            {businessName}
          </h1>
          <p
            className="uppercase tracking-widest font-semibold mt-1"
            style={{ fontSize: "clamp(0.5rem, 0.8vw, 0.75rem)", color: theme.navSub }}
          >
            {businessType} Queue
          </p>
        </div>

        <div className="flex items-center gap-8">
          <DisplayClock timeColor={theme.navTitle} dateColor={theme.navSub} />
          <button
            onClick={toggleFullscreen}
            className="font-semibold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ fontSize: "clamp(0.5rem, 0.75vw, 0.7rem)", color: theme.navBtn }}
          >
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT COLUMN — 40% */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: "40%", borderRight: `1px solid ${theme.sectionBorder}` }}
        >

          {/* NOW SERVING */}
          <div
            className="relative flex flex-col items-center justify-center overflow-hidden"
            style={{
              flex: 3,
              backgroundColor: theme.servingBg,
              borderBottom: `1px solid ${theme.servingBorder}`,
            }}
          >
            <p
              className="font-black uppercase tracking-[0.5em]"
              style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.8rem)", color: theme.servingLabel }}
            >
              Now Serving
            </p>

            <div className="flex flex-col items-center mt-4">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentServingNumber}
                  variants={flipNumber}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="font-black tabular-nums"
                  style={{
                    fontSize: "clamp(6rem, 16vw, 16rem)",
                    lineHeight: 0.9,
                    color: theme.servingNumber,
                  }}
                >
                  {currentServingNumber || "—"}
                </motion.p>
              </AnimatePresence>

              {currentEntry ? (
                <motion.p
                  key={currentEntry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 font-mono font-semibold"
                  style={{ fontSize: "clamp(0.9rem, 1.8vw, 1.6rem)", color: theme.servingBill }}
                >
                  Bill {currentEntry.billNumber}
                </motion.p>
              ) : (
                <p
                  className="mt-5"
                  style={{ fontSize: "clamp(0.8rem, 1.3vw, 1.1rem)", color: theme.servingEmpty }}
                >
                  Waiting for next customer
                </p>
              )}
            </div>

            {/* CALLING OVERLAY */}
            <AnimatePresence>
              {calledInfo && (
                <motion.div
                  key={calledInfo.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.6 } }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                  style={{ backgroundColor: theme.callingBg }}
                >
                  <motion.p
                    animate={{ opacity: [1, 0.1, 1] }}
                    transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut" }}
                    className="font-black uppercase tracking-[0.6em]"
                    style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.8rem)", color: theme.callingLabel }}
                  >
                    Now Calling
                  </motion.p>

                  <motion.p
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 0.08 }}
                    className="font-black tabular-nums mt-6"
                    style={{
                      fontSize: "clamp(6rem, 16vw, 16rem)",
                      lineHeight: 0.9,
                      color: theme.callingNum,
                    }}
                  >
                    {calledInfo.queueNumber}
                  </motion.p>

                  <p
                    className="mt-8 font-medium"
                    style={{ fontSize: "clamp(0.9rem, 1.6vw, 1.4rem)", color: theme.callingSub }}
                  >
                    Please proceed to the counter
                  </p>

                  {calledInfo.callCount > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 flex items-center gap-2 rounded-full px-5 py-2"
                      style={{
                        backgroundColor: theme.callingRecallBg,
                        border: `1px solid ${theme.callingRecallBorder}`,
                      }}
                    >
                      <span
                        className="size-2 rounded-full animate-pulse"
                        style={{ backgroundColor: theme.callingRecallDot }}
                      />
                      <span
                        className="font-semibold uppercase tracking-widest"
                        style={{ fontSize: "clamp(0.6rem, 0.9vw, 0.8rem)", color: theme.callingRecallText }}
                      >
                        Recalled ×{calledInfo.callCount}
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* NEXT IN LINE + RECENTLY SERVED */}
          <div className="flex overflow-hidden" style={{ flex: 2 }}>

            {/* Next in Line */}
            <div
              className="flex flex-1 flex-col overflow-hidden px-4 py-3"
              style={{
                backgroundColor: theme.nextBg,
                borderRight: `1px solid ${theme.sectionBorder}`,
              }}
            >
              <p
                className="shrink-0 font-black uppercase tracking-[0.4em] mb-2"
                style={{ fontSize: "clamp(0.5rem, 0.8vw, 0.7rem)", color: theme.sectionLabel }}
              >
                Next in Line
              </p>
              <div className="flex-1 overflow-hidden flex flex-col gap-1.5">
                <AnimatePresence>
                  {nextWaiting.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-1 items-center gap-3 rounded-lg px-4"
                      style={{
                        backgroundColor: theme.rowBg,
                        border: `1px solid ${theme.rowBorder}`,
                      }}
                    >
                      <p
                        className="font-black tabular-nums shrink-0"
                        style={{
                          fontSize: "clamp(1.1rem, 2.2vw, 2rem)",
                          width: "clamp(2rem, 3vw, 3rem)",
                          color: theme.rowNum,
                        }}
                      >
                        {entry.queueNumber}
                      </p>
                      <p
                        className="font-mono font-semibold truncate"
                        style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)", color: theme.rowBill }}
                      >
                        Bill {entry.billNumber}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {nextWaiting.length === 0 && (
                  <p
                    className="text-center py-6"
                    style={{ fontSize: "clamp(0.7rem, 1vw, 0.9rem)", color: theme.emptyText }}
                  >
                    Queue is empty
                  </p>
                )}
              </div>
            </div>

            {/* Recently Served */}
            <div
              className="flex flex-1 flex-col overflow-hidden px-4 py-3"
              style={{ backgroundColor: theme.recentBg }}
            >
              <p
                className="shrink-0 font-black uppercase tracking-[0.4em] mb-2"
                style={{ fontSize: "clamp(0.5rem, 0.8vw, 0.7rem)", color: theme.sectionLabel }}
              >
                Recently Served
              </p>
              <div className="flex-1 overflow-hidden flex flex-col gap-1.5">
                <AnimatePresence>
                  {recentCompleted.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-1 items-center gap-3 rounded-lg px-4"
                      style={{
                        backgroundColor: theme.rowBg,
                        border: `1px solid ${theme.rowBorder}`,
                      }}
                    >
                      <p
                        className="font-black tabular-nums shrink-0"
                        style={{
                          fontSize: "clamp(1.1rem, 2.2vw, 2rem)",
                          width: "clamp(2rem, 3vw, 3rem)",
                          color: theme.rowNumDone,
                        }}
                      >
                        {entry.queueNumber}
                      </p>
                      <p
                        className="font-mono font-medium truncate"
                        style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)", color: theme.rowBillDone }}
                      >
                        {entry.billNumber}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {recentCompleted.length === 0 && (
                  <p
                    className="text-center py-6"
                    style={{ fontSize: "clamp(0.7rem, 1vw, 0.9rem)", color: theme.emptyText }}
                  >
                    No recent entries
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN — 60% AD SCREEN */}
        <div className="overflow-hidden" style={{ flex: 1 }}>
          <AdPanel />
        </div>

      </div>

      {/* ── FOOTER TICKER ── */}
      <AdTicker
        bg={theme.tickerBg}
        border={theme.tickerBorder}
        chipBg={theme.tickerChipBg}
        chipText={theme.tickerChipText}
        textColor={theme.tickerText}
      />
    </div>
  )
}
