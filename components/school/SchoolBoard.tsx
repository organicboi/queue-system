'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { Volume2 } from 'lucide-react'
import { AdPanel } from '@/components/display/AdPanel'
import { DisplayClock } from '@/components/display/DisplayClock'
import { useSchoolBoard } from '@/lib/hooks/useSchoolBoard'
import { SchoolAnnouncer } from '@/lib/school/announce'
import type { SchoolBoardPacket } from '@/lib/db/school-types'
import type { AdDTO } from '@/lib/db/types'

// Guest display surface — design system v5 §5.5. Dark canvas, one accent
// surface, mono numbers sized to be read from 3–8 m, no shadows (invisible at
// distance), nothing tappable. The board is one row per service window, always
// visible, so a quiet counter doesn't disappear off the list.

const FLASH_MS = 8000

export function SchoolBoard({ screenToken, initial }: {
  screenToken: string
  initial: SchoolBoardPacket
}) {
  const { packet, lastCall } = useSchoolBoard(screenToken, initial)
  // Lazy initialiser rather than a ref written during render: the announcer is
  // created once, and reading it while rendering stays legal.
  const [announcer] = useState(() => new SchoolAnnouncer())
  const [audioReady, setAudioReady] = useState(false)
  // Flash is derived, not stored: the overlay shows the latest call until its
  // key is dismissed. Storing a copy would mean writing state from an effect
  // on every call.
  const [dismissedKey, setDismissedKey] = useState(0)
  const flash = lastCall && lastCall.key !== dismissedKey ? lastCall : null

  useEffect(() => {
    // The Android WebView injects window.AndroidTTS after the bundle loads, so
    // this capability can only be read on the client, after mount. Reading it
    // in the useState initialiser instead would render differently on server
    // and client and trip a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (announcer.isReady) setAudioReady(true)
  }, [announcer])

  // `lastCall.key` increments on every call event, so a recall of the same
  // token re-runs this effect and re-announces.
  useEffect(() => {
    if (!lastCall) return

    if (packet.announceEnabled !== false && audioReady) {
      announcer.announce({
        tokenCode: lastCall.tokenCode,
        counterEn: lastCall.counterEn,
        counterAr: lastCall.counterAr,
        lang: packet.announcementLang ?? 'en',
        templateEn: packet.announceTemplateEn ?? 'Token {token}, please proceed to {counter}',
        templateAr: packet.announceTemplateAr ?? '',
      })
    }

    const key = lastCall.key
    const t = setTimeout(() => setDismissedKey(key), FLASH_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCall?.key, audioReady])

  const ads: AdDTO[] = useMemo(
    () =>
      (packet.ads ?? [])
        .filter((a) => a.is_active)
        .map((a) => ({
          id: a.id,
          customerId: '',
          branchId: null,
          name: '',
          fileUrl: a.file_url,
          fileType: a.file_type,
          fileSizeBytes: 0,
          durationSeconds: a.duration_seconds || 8,
          displayOrder: 0,
          isActive: true,
          createdAt: '',
        })),
    [packet.ads]
  )

  const tickerLines = (packet.tickers ?? []).map((t) => t.message)
  const ticker = [packet.tickerText, ...tickerLines].filter(Boolean).join('   •   ')
  const counters = (packet.counters ?? []).filter((c) => c.is_open)
  const hasAds = ads.length > 0

  if (packet.status === 'expired') {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-slate-900 text-slate-300">
        <p className="text-2xl font-semibold">This display is not active.</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh w-screen flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-4 bg-slate-950 px-6 py-3">
        {packet.logoUrl ? (
          <Image
            src={packet.logoUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-lg object-contain"
            unoptimized
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-bold leading-tight"
            style={{ fontSize: 'clamp(1.2rem, 2.2vw, 2.4rem)' }}
          >
            {packet.schoolName}
          </p>
          {packet.schoolNameAr ? (
            <p dir="rtl" className="truncate text-slate-400" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.3rem)' }}>
              {packet.schoolNameAr}
            </p>
          ) : null}
        </div>
        {packet.showClock !== false && (
          <DisplayClock timeColor="#F1F5F9" dateColor="#94A3B8" />
        )}
      </header>

      {/* Board + ads */}
      <div className="flex min-h-0 flex-1">
        <main className={hasAds ? 'flex min-w-0 flex-[62] flex-col' : 'flex min-w-0 flex-1 flex-col'}>
          <div className="grid shrink-0 grid-cols-[1fr_1fr_1fr] gap-4 bg-slate-800 px-6 py-2 text-slate-400">
            <HeaderCell en="TOKEN NO." ar="رقم التذكرة" />
            <HeaderCell en="COUNTER" ar="الشباك" />
            <HeaderCell en="STATUS" ar="الحالة" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
            {counters.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-slate-500">
                <p style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>No counters are open right now</p>
              </div>
            ) : (
              counters.map((counter) => {
                const isFlashing = flash?.tokenCode && flash.tokenCode === counter.token_code
                return (
                  <motion.div
                    key={counter.id}
                    animate={isFlashing ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={
                      counter.token_code
                        ? 'grid min-h-0 flex-1 grid-cols-[1fr_1fr_1fr] items-center gap-4 rounded-2xl border border-accent-500 bg-accent-600 px-6'
                        : 'grid min-h-0 flex-1 grid-cols-[1fr_1fr_1fr] items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800 px-6'
                    }
                  >
                    <p
                      dir="ltr"
                      className="truncate font-mono font-black tabular-nums"
                      style={{ fontSize: 'clamp(2rem, 6vw, 6rem)' }}
                    >
                      {counter.token_code ?? '—'}
                    </p>
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ fontSize: 'clamp(1rem, 2.4vw, 2.6rem)' }}>
                        {counter.name_en}
                      </p>
                      {counter.department_en && (
                        <p
                          className={counter.token_code ? 'truncate text-accent-50' : 'truncate text-slate-400'}
                          style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1.2rem)' }}
                        >
                          {counter.department_en}
                        </p>
                      )}
                    </div>
                    <p
                      className="truncate font-semibold"
                      style={{ fontSize: 'clamp(0.9rem, 2vw, 2.2rem)' }}
                    >
                      {counter.token_code ? 'Please Proceed' : 'Available'}
                    </p>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Waiting counts — the "how long until me" question the token
              alone can't answer. */}
          {(packet.departments ?? []).length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-800 px-6 py-2">
              {(packet.departments ?? []).map((d) => (
                <span key={d.id} className="flex items-center gap-2 text-slate-400">
                  <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1rem)' }}>{d.name_en}</span>
                  <span
                    dir="ltr"
                    className="font-mono font-bold tabular-nums text-slate-200"
                    style={{ fontSize: 'clamp(0.7rem, 1vw, 1.1rem)' }}
                  >
                    {d.waiting}
                  </span>
                </span>
              ))}
            </div>
          )}
        </main>

        {hasAds && (
          <aside className="min-w-0 flex-[38] border-s border-slate-800">
            <AdPanel ads={ads} />
          </aside>
        )}
      </div>

      {/* Ticker */}
      {ticker && (
        <footer className="shrink-0 overflow-hidden bg-slate-950 py-2">
          <div className="animate-[school-marquee_38s_linear_infinite] whitespace-nowrap">
            <span className="px-8 text-slate-300" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.4rem)' }}>
              {ticker}
            </span>
          </div>
        </footer>
      )}

      {/* One-shot call overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95"
          >
            <p className="text-slate-400" style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>
              {flash.recallCount > 0 ? 'Calling again' : 'Now calling'}
            </p>
            <p
              dir="ltr"
              className="font-mono font-black tabular-nums text-accent-400"
              style={{ fontSize: 'clamp(5rem, 18vw, 18rem)', lineHeight: 1 }}
            >
              {flash.tokenCode}
            </p>
            <p className="mt-2 font-semibold" style={{ fontSize: 'clamp(1.4rem, 4vw, 4rem)' }}>
              {flash.counterEn}
            </p>
            {flash.departmentEn && (
              <p className="text-slate-400" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.6rem)' }}>
                {flash.departmentEn}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browsers block audio until a gesture. The Android shell sets
          mediaPlaybackRequiresUserGesture=false, so it never sees this. */}
      {!audioReady && packet.announceEnabled !== false && (
        <button
          type="button"
          onClick={() => {
            announcer.unlock()
            setAudioReady(true)
          }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/90 text-slate-200"
        >
          <Volume2 className="size-12" />
          <span className="text-2xl font-semibold">Tap anywhere to enable announcements</span>
        </button>
      )}
    </div>
  )
}

function HeaderCell({ en, ar }: { en: string; ar: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold tracking-wider" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1.2rem)' }}>
        {en}
      </p>
      <p dir="rtl" className="truncate text-slate-500" style={{ fontSize: 'clamp(0.6rem, 0.9vw, 1rem)' }}>
        {ar}
      </p>
    </div>
  )
}
