"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import type { AdDTO } from "@/lib/db/types"

interface DisplayAd {
  id: string | number
  src: string
  type: 'image' | 'video'
  durationMs: number
}

interface AdPanelProps {
  ads?: AdDTO[]
}

export function AdPanel({ ads }: AdPanelProps) {
  const activeAds = (ads ?? []).filter((a) => a.isActive)
  const slides: DisplayAd[] = activeAds.map((a) => ({
    id: a.id,
    src: a.fileUrl,
    type: a.fileType,
    durationMs: a.durationSeconds * 1000,
  }))

  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)

  // Modulo keeps `current` in bounds even if the resolved ad list shrinks
  // (e.g. an admin unchecks a slide) without needing a reset effect.
  const ad = slides[current % slides.length] ?? slides[0]
  const slideDuration = ad?.durationMs ?? 8000

  useEffect(() => {
    if (slides.length === 0) return
    setProgress(0)
    const start = Date.now()
    const tick = setInterval(() => {
      setProgress(Math.min(((Date.now() - start) / slideDuration) * 100, 100))
    }, 50)
    const advance = setTimeout(() => {
      setCurrent((c) => (c + 1) % slides.length)
    }, slideDuration)
    return () => {
      clearInterval(tick)
      clearTimeout(advance)
    }
  }, [current, slideDuration, slides.length])

  if (!ad) return null

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {ad.type === 'video' ? (
            <video
              src={ad.src}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <Image
              src={ad.src}
              alt="Advertisement"
              fill
              className="object-contain"
              priority={current === 0}
              sizes="60vw"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Progress bar indicators */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-3 z-10">
        {slides.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setCurrent(i)}
            className="relative h-0.75 rounded-full overflow-hidden transition-all duration-500"
            style={{
              width: i === current ? "clamp(2rem, 4vw, 3.5rem)" : "clamp(0.5rem, 1vw, 0.75rem)",
              backgroundColor: "rgba(255,255,255,0.25)",
            }}
          >
            {i === current && (
              <motion.span
                className="absolute inset-y-0 start-0 rounded-full bg-white"
                style={{ width: `${progress}%` }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Ad label */}
      <div className="absolute top-4 end-5 z-10">
        <p
          className="font-bold uppercase tracking-[0.3em] text-white/20"
          style={{ fontSize: "clamp(0.45rem, 0.65vw, 0.6rem)" }}
        >
          Advertisement
        </p>
      </div>
    </div>
  )
}
