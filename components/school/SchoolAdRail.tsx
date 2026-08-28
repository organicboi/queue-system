'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { Volume2, VolumeX } from 'lucide-react'

// The school board's right-hand ad rail. One ad fills the panel at a time and
// auto-advances — deliberately NOT a scrolling stack, so a video ad can play
// its own soundtrack without three others talking over it. Light-themed to
// match the rest of the product (components/display/AdPanel.tsx is the dark
// business equivalent and is left untouched).

export interface SchoolAd {
  id: string
  src: string
  type: 'image' | 'video'
  durationMs: number
  audioEnabled: boolean
}

// A video that never fires `ended` (corrupt file, codec stall) must not freeze
// the rail forever.
const VIDEO_FALLBACK_MS = 10 * 60 * 1000

export function SchoolAdRail({ ads, audioReady }: { ads: SchoolAd[]; audioReady: boolean }) {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Modulo keeps the index valid even if the ad list shrinks under us (an admin
  // disables a slide) without a reset effect.
  const ad = ads.length > 0 ? ads[current % ads.length] : null
  const soundOn = !!ad && ad.type === 'video' && ad.audioEnabled && audioReady

  const next = () => setCurrent((c) => (ads.length > 0 ? (c + 1) % ads.length : 0))

  // Advance + progress. Images run on a fixed timer; videos advance when they
  // end (with a long safety timeout), and their progress tracks playback.
  useEffect(() => {
    if (!ad) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0)
    const start = Date.now()

    if (ad.type === 'image') {
      if (ads.length <= 1) return
      const tick = setInterval(
        () => setProgress(Math.min(((Date.now() - start) / ad.durationMs) * 100, 100)),
        100
      )
      const advance = setTimeout(next, ad.durationMs)
      return () => {
        clearInterval(tick)
        clearTimeout(advance)
      }
    }

    // video: progress comes from onTimeUpdate; this is just the stuck-file guard
    const fallback = setTimeout(next, Math.max(ad.durationMs, VIDEO_FALLBACK_MS))
    return () => clearTimeout(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ad?.id, ads.length])

  // React can drop the `muted` attribute on hydration; set it on the element.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn
  }, [soundOn, current])

  if (!ad) return null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {ad.type === 'video' ? (
            <video
              ref={videoRef}
              src={ad.src}
              autoPlay
              muted={!soundOn}
              loop={ads.length <= 1}
              playsInline
              onEnded={() => {
                if (ads.length > 1) next()
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                if (v.duration) setProgress(Math.min((v.currentTime / v.duration) * 100, 100))
              }}
              className="h-full w-full object-contain"
            />
          ) : (
            <Image
              src={ad.src}
              alt=""
              fill
              className="object-contain"
              priority={current === 0}
              sizes="40vw"
              unoptimized
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sound state — only shown for a video that wants sound. */}
      {ad.type === 'video' && ad.audioEnabled && (
        <div className="absolute start-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 py-1 text-white">
          {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          <span className="text-[0.6rem] font-semibold uppercase tracking-wider">
            {soundOn ? 'Sound on' : 'Muted'}
          </span>
        </div>
      )}

      {/* Progress indicators */}
      {ads.length > 1 && (
        <div className="absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-2">
          {ads.map((a, i) => (
            <span
              key={a.id}
              className="relative h-1 overflow-hidden rounded-full bg-slate-300 transition-all duration-500"
              style={{ width: i === current ? 'clamp(1.75rem, 3.5vw, 3rem)' : 'clamp(0.4rem, 0.9vw, 0.6rem)' }}
            >
              {i === current && (
                <span
                  className="absolute inset-y-0 start-0 rounded-full bg-accent-600"
                  style={{ width: `${progress}%` }}
                />
              )}
            </span>
          ))}
        </div>
      )}

      <div className="absolute end-4 top-4 z-10">
        <p
          className="font-bold uppercase tracking-[0.3em] text-slate-400"
          style={{ fontSize: 'clamp(0.45rem, 0.65vw, 0.6rem)' }}
        >
          Advertisement
        </p>
      </div>
    </div>
  )
}
