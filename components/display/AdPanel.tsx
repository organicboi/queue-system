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

// Shown for a fresh tenant with no ads configured yet, so the display never
// looks broken while they set up their own.
const DEMO_ADS: DisplayAd[] = [
  { id: 1, src: "/ads/ad1.jpg", type: 'image', durationMs: 8000 },
  { id: 2, src: "/ads/ads2.jpg", type: 'image', durationMs: 8000 },
  { id: 3, src: "/ads/ads3.png", type: 'image', durationMs: 8000 },
]

interface AdPanelProps {
  ads?: AdDTO[]
}

export function AdPanel({ ads }: AdPanelProps) {
  const activeAds = (ads ?? []).filter((a) => a.isActive)
  const slides: DisplayAd[] = activeAds.length > 0
    ? activeAds.map((a) => ({ id: a.id, src: a.fileUrl, type: a.fileType, durationMs: a.durationSeconds * 1000 }))
    : DEMO_ADS

  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)

  // Reset to the first slide whenever the resolved ad list changes (e.g. an
  // admin updates the picker) so we don't index past the end.
  useEffect(() => {
    setCurrent(0)
  }, [slides.length])

  const ad = slides[current % slides.length] ?? slides[0]
  const slideDuration = ad?.durationMs ?? 8000

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              unoptimized={ad.src.startsWith('http')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Progress bar indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 z-10">
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
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ width: `${progress}%` }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Ad label */}
      <div className="absolute top-4 right-5 z-10">
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
