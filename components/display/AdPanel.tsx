"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"

const ADS = [
  { id: 1, src: "/ads/ad1.jpg" },
  { id: 2, src: "/ads/ads2.jpg" },
  { id: 3, src: "/ads/ads3.png" },
]

const SLIDE_DURATION = 8000

export function AdPanel() {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(0)
    const start = Date.now()
    const tick = setInterval(() => {
      setProgress(Math.min(((Date.now() - start) / SLIDE_DURATION) * 100, 100))
    }, 50)
    const advance = setTimeout(() => {
      setCurrent((c) => (c + 1) % ADS.length)
    }, SLIDE_DURATION)
    return () => {
      clearInterval(tick)
      clearTimeout(advance)
    }
  }, [current])

  const ad = ADS[current]

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
          <Image
            src={ad.src}
            alt="Advertisement"
            fill
            className="object-contain"
            priority={ad.id === 1}
            sizes="60vw"
          />
        </motion.div>
      </AnimatePresence>

      {/* Progress bar indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 z-10">
        {ADS.map((a, i) => (
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
