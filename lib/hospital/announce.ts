'use client'

import type { Locale, LocaleMap } from '@/lib/region'
import { pickLocale } from '@/lib/region'

// Three-tier announcer, ported from lib/school/announce.ts rather than shared:
// the school board we promised not to destabilise owns that file, and a
// hospital call names a ROOM (and often a doctor), not a counter — a shared
// signature would fit neither well.
//
//   1. Android WebView native TTS  (window.AndroidTTS)  — the kiosk shell
//   2. Web Speech API + a WebAudio chime                — desktop/TV browsers
//   3. Chime only                                       — no speech available
//
// Web Speech covers hi-IN and mr-IN on-device — good enough for a v1 with no
// TTS service.

export interface HospitalAnnounceInput {
  tokenCode: string
  /** Room label per locale ('Room 4' / 'Pharmacy 1'). `en` is the fallback. */
  room: LocaleMap
  /** Announcement template per locale, with {token} / {room} placeholders. */
  templates: LocaleMap
  /** Locales to speak, in order. */
  locales: Locale[]
}

// Which locales need which BCP-47 voice. A locale with no matching voice
// installed falls back to the English text on the en-IN voice (see doSpeak).
const VOICE: Record<Locale, string> = {
  en: 'en-IN',
  ar: 'ar-SA',
  mr: 'mr-IN',
  hi: 'hi-IN',
}

// Speech engines read "C104" as a word, and a bare number as a cardinal ("one
// hundred and four"). Spell the prefix letters and read the digits separately
// so it survives a noisy waiting hall. Same rule as the school speller.
export function spellToken(code: string | null | undefined): string {
  if (!code) return ''
  const match = code.match(/^([A-Za-z]*)(\d*)$/)
  if (!match) return code.split('').join(', ')
  const [, letters, digits] = match
  const spelledLetters = letters.split('').join(', ')
  const spelledDigits = digits.length >= 3 ? digits.split('').join(', ') : digits
  return [spelledLetters, spelledDigits].filter(Boolean).join(', ')
}

function fill(template: string, token: string, room: string): string {
  return template.replace(/\{token\}/g, token).replace(/\{room\}/g, room)
}

export class HospitalAnnouncer {
  private ctx: AudioContext | null = null
  private ready = false

  constructor() {
    if (typeof window !== 'undefined' && 'AndroidTTS' in window) this.ready = true
  }

  get isReady() {
    return this.ready
  }

  // Browsers refuse audio until a gesture, so the board shows a tap curtain
  // once. The Android shell sets mediaPlaybackRequiresUserGesture=false, hence
  // the constructor short-circuit above.
  unlock() {
    if (typeof window === 'undefined') return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
      if (Ctx) this.ctx = new Ctx()
    } catch { /* no WebAudio — speech or silence still work */ }

    if ('speechSynthesis' in window) {
      const silent = new SpeechSynthesisUtterance(' ')
      silent.volume = 0
      window.speechSynthesis.speak(silent)
      setTimeout(() => window.speechSynthesis.cancel(), 200)
    }
    this.ready = true
  }

  chime() {
    const ctx = this.ctx
    if (!ctx) return
    try {
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.55, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
      osc.start(t)
      osc.stop(t + 1.4)
    } catch { /* chime is decoration; never let it break the call */ }
  }

  announce({ tokenCode, room, templates, locales }: HospitalAnnounceInput) {
    if (typeof window === 'undefined') return
    // Nothing to say without a token code, and announcing "please proceed to
    // Room 4" with no number is worse than silence. Belt-and-braces with the
    // server-side guard: this runs on a ceiling-mounted TV nobody can reload.
    if (!tokenCode) return

    const speakLocales = locales.length ? locales : (['en'] as Locale[])

    // Devanagari (mr/hi) reads digits and a spelled Latin letter fine, so every
    // locale uses the plain speller — no transliteration table needed.
    const DEFAULT_TEMPLATE = 'Token {token}, please proceed to {room}'
    const textFor = (l: Locale) => {
      const template = pickLocale(templates, l) || templates.en || DEFAULT_TEMPLATE
      const roomName = pickLocale(room, l) || room.en
      return fill(template, spellToken(tokenCode), roomName)
    }

    if ('AndroidTTS' in window) {
      const text = speakLocales.map(textFor).filter(Boolean).join('  ')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).AndroidTTS.speak(text)
      return
    }

    this.chime()
    if (!('speechSynthesis' in window)) return

    const findVoice = (target: string): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices()
      const prefix = target.split('-')[0]
      return (
        voices.find((v) => v.lang === target) ??
        voices.find((v) => v.lang.startsWith(prefix)) ??
        null
      )
    }

    const speakOne = (text: string, voiceLang: string): Promise<void> =>
      new Promise((resolve) => {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = voiceLang
        u.rate = 0.82
        const voice = findVoice(voiceLang)
        if (voice) u.voice = voice
        u.onend = () => resolve()
        u.onerror = () => resolve()
        window.speechSynthesis.speak(u)
      })

    const doSpeak = async () => {
      let lastSpoken = ''
      const say = async (text: string, voiceLang: string) => {
        if (!text.trim() || text === lastSpoken) return
        lastSpoken = text
        await speakOne(text, voiceLang)
      }
      for (const l of speakLocales) {
        const target = VOICE[l] ?? 'en-IN'
        if (findVoice(target)) {
          await say(textFor(l), target)
        } else {
          // No voice for this locale on this TV — the English wording on the
          // English voice beats silence (and never repeats a line just said).
          await say(textFor('en'), 'en-IN')
        }
      }
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak()
    } else {
      const onReady = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onReady)
        doSpeak()
      }
      window.speechSynthesis.addEventListener('voiceschanged', onReady)
    }
  }
}
