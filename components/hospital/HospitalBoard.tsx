'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { Volume2 } from 'lucide-react'
import { DisplayClock } from '@/components/display/DisplayClock'
import { useHospitalBoard } from '@/lib/hooks/useHospitalBoard'
import { HospitalAnnouncer } from '@/lib/hospital/announce'
import type { HospitalBoardPacket } from '@/lib/db/hospital-types'
import type { Locale } from '@/lib/region'
import { coerceLocales, defaultLocale, dirFor, pickLocale, regionLocales } from '@/lib/region'

const FLASH_MS = 8000

const COPY: Record<Locale, {
  token: string; room: string; doctor: string; waiting: string
  nowCalling: string; callingAgain: string; noRooms: string
  notActive: string; enableSound: string; proceed: string; free: string
}> = {
  en: {
    token: 'TOKEN', room: 'ROOM', doctor: 'DOCTOR', waiting: 'waiting',
    nowCalling: 'Now calling', callingAgain: 'Calling again', noRooms: 'No rooms are open right now',
    notActive: 'This display is not active.', enableSound: 'Tap anywhere to enable sound',
    proceed: 'Please proceed', free: 'Free',
  },
  hi: {
    token: 'टोकन', room: 'कक्ष', doctor: 'डॉक्टर', waiting: 'प्रतीक्षारत',
    nowCalling: 'अभी बुला रहे हैं', callingAgain: 'फिर से बुला रहे हैं', noRooms: 'अभी कोई कक्ष खुला नहीं है',
    notActive: 'यह डिस्प्ले सक्रिय नहीं है.', enableSound: 'ध्वनि चालू करने के लिए कहीं भी स्पर्श करें',
    proceed: 'कृपया आगे बढ़ें', free: 'खाली',
  },
  mr: {
    token: 'टोकन', room: 'कक्ष', doctor: 'डॉक्टर', waiting: 'प्रतीक्षेत',
    nowCalling: 'आता बोलावत आहे', callingAgain: 'पुन्हा बोलावत आहे', noRooms: 'सध्या कोणतेही कक्ष उघडे नाही',
    notActive: 'हा डिस्प्ले सक्रिय नाही.', enableSound: 'आवाज सुरू करण्यासाठी कुठेही स्पर्श करा',
    proceed: 'कृपया पुढे या', free: 'रिकामे',
  },
  ar: {
    token: 'التذكرة', room: 'الغرفة', doctor: 'الطبيب', waiting: 'في الانتظار',
    nowCalling: 'النداء الآن', callingAgain: 'إعادة النداء', noRooms: 'لا توجد غرف مفتوحة الآن',
    notActive: 'هذه الشاشة غير مفعّلة.', enableSound: 'انقر في أي مكان لتفعيل الصوت',
    proceed: 'يرجى التوجه', free: 'متاح',
  },
}

export function HospitalBoard({ screenToken, initial }: {
  screenToken: string
  initial: HospitalBoardPacket
}) {
  const { packet, lastCall } = useHospitalBoard(screenToken, initial)
  const boardLocale = defaultLocale()
  const bc = COPY[boardLocale] ?? COPY.en
  const boardRtl = dirFor(boardLocale) === 'rtl'

  const announceLocales: Locale[] = packet.announceLocales?.length
    ? coerceLocales(packet.announceLocales)
    : packet.announcementLang === 'both'
      ? regionLocales()
      : coerceLocales(packet.announcementLang ? [packet.announcementLang] : [boardLocale])

  const [announcer] = useState(() => new HospitalAnnouncer())
  const [audioReady, setAudioReady] = useState(false)
  const [dismissedKey, setDismissedKey] = useState(0)
  const flash = lastCall && lastCall.key !== dismissedKey ? lastCall : null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (announcer.isReady) setAudioReady(true)
  }, [announcer])

  useEffect(() => {
    if (!lastCall) return
    if (packet.announceEnabled !== false && audioReady) {
      announcer.announce({
        tokenCode: lastCall.tokenCode,
        room: { en: lastCall.roomLabel },
        templates: packet.announceTemplateI18n ?? { en: 'Token {token}, please proceed to {room}' },
        locales: announceLocales,
      })
    }
    const key = lastCall.key
    const t = setTimeout(() => setDismissedKey(key), FLASH_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCall?.key, audioReady])

  const tickerLines = (packet.tickers ?? []).map((t) => t.message)
  const ticker = [packet.tickerText, ...tickerLines].filter(Boolean).join('   •   ')
  const rooms = (packet.rooms ?? []).filter((r) => r.is_open)
  const twoCol = rooms.length > 6

  if (packet.status === 'expired') {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-slate-50 text-slate-500">
        <p className="text-2xl font-semibold" dir={dirFor(boardLocale)}>{bc.notActive}</p>
      </div>
    )
  }

  return (
    <div dir={dirFor(boardLocale)} className="relative flex h-dvh w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        {packet.logoUrl ? (
          <Image src={packet.logoUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-lg object-contain" unoptimized />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight text-slate-900" style={{ fontSize: 'clamp(1.2rem, 2.2vw, 2.4rem)' }}>
            {packet.hospitalName}
          </p>
          {regionLocales().slice(1).map((l) => {
            const name = packet.hospitalNameI18n?.[l]
            return name ? (
              <p key={l} dir={dirFor(l)} className="truncate text-slate-500" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.3rem)' }}>{name}</p>
            ) : null
          })}
        </div>
        {packet.showClock !== false && <DisplayClock timeColor="#0F172A" dateColor="#64748B" />}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-[1.1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-white px-6 py-2 text-slate-500">
          <Cell label={bc.token} />
          <Cell label={bc.room} />
          <Cell label={bc.doctor} />
        </div>

        <div className={twoCol ? 'grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-3 p-3' : 'flex min-h-0 flex-1 flex-col gap-2.5 p-3'}>
          {rooms.length === 0 ? (
            <div className="col-span-full flex flex-1 items-center justify-center text-slate-400">
              <p style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>{bc.noRooms}</p>
            </div>
          ) : (
            rooms.map((room) => {
              const called = !!room.token_code
              const isFlashing = flash?.tokenCode && flash.tokenCode === room.token_code
              return (
                <motion.div
                  key={room.id}
                  animate={isFlashing ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={
                    'grid min-h-0 flex-1 grid-cols-[1.1fr_1fr_1fr] items-center gap-4 rounded-2xl border px-6 ' +
                    (called ? 'border-accent-600 bg-accent-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-900')
                  }
                >
                  <p dir="ltr" className="truncate font-mono font-black tabular-nums" style={{ fontSize: 'clamp(2rem, 6vw, 6rem)' }}>
                    {room.token_code ?? '—'}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate font-semibold" style={{ fontSize: 'clamp(1rem, 2.2vw, 2.4rem)' }}>{room.label}</p>
                    <p className={called ? 'truncate text-white/80' : 'truncate text-slate-500'} style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1.2rem)' }}>
                      {called ? bc.proceed : bc.free}
                    </p>
                  </div>
                  <p className="truncate font-semibold" style={{ fontSize: 'clamp(0.9rem, 2vw, 2.2rem)' }}>
                    {room.doctor_name ?? (room.department_en ?? '')}
                    {room.doctor_on_leave ? ' · on leave' : ''}
                  </p>
                </motion.div>
              )
            })
          )}
        </div>

        {(packet.departments ?? []).length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-6 py-2">
            {(packet.departments ?? []).filter((d) => d.waiting > 0).map((d) => (
              <span key={d.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-600" style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1rem)' }}>
                  {pickLocale(d.name, boardLocale) || d.name_en}
                </span>
                <span dir="ltr" className="font-mono font-bold tabular-nums text-slate-900" style={{ fontSize: 'clamp(0.7rem, 1vw, 1.1rem)' }}>
                  {d.waiting}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {ticker && (
        <footer className="flex shrink-0 items-stretch overflow-hidden border-t border-slate-200 bg-white">
          <div className="w-1.5 shrink-0 bg-accent-600" />
          <div className="flex-1 overflow-hidden py-2">
            <div className={boardRtl ? 'animate-[school-marquee-rtl_38s_linear_infinite] whitespace-nowrap' : 'animate-[school-marquee_38s_linear_infinite] whitespace-nowrap'}>
              <span className="px-8 text-slate-600" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.4rem)' }}>{ticker}</span>
            </div>
          </div>
        </footer>
      )}

      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-8 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }}
              className="flex w-full max-w-4xl flex-col items-center rounded-3xl border border-slate-200 bg-white px-10 py-12 text-center shadow-2xl"
            >
              <p className="font-semibold uppercase tracking-[0.2em] text-slate-400" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.6rem)' }}>
                {flash.recallCount > 0 ? bc.callingAgain : bc.nowCalling}
              </p>
              <p dir="ltr" className="font-mono font-black tabular-nums text-accent-600" style={{ fontSize: 'clamp(5rem, 18vw, 16rem)', lineHeight: 1 }}>
                {flash.tokenCode}
              </p>
              <p className="mt-3 font-semibold text-slate-900" style={{ fontSize: 'clamp(1.4rem, 4vw, 3.5rem)' }}>{flash.roomLabel}</p>
              {flash.doctorName && (
                <p className="text-slate-500" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.6rem)' }}>{flash.doctorName}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!audioReady && packet.announceEnabled !== false && (
        <button
          type="button"
          onClick={() => { announcer.unlock(); setAudioReady(true) }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/95 text-slate-700"
        >
          <Volume2 className="size-12 text-accent-600" />
          <span className="text-2xl font-semibold">{bc.enableSound}</span>
        </button>
      )}
    </div>
  )
}

function Cell({ label }: { label: string }) {
  return (
    <p className="truncate font-semibold tracking-wider" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1.2rem)' }}>{label}</p>
  )
}
