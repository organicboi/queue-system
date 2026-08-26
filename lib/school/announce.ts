'use client'

import type { AnnouncementLang } from '@/lib/db/types'

// Three-tier announcer, ported from components/display/TVDisplay.tsx rather
// than extracted from it: the board we promised not to destabilise is the
// business one, and school tokens differ enough (a letter-prefixed string, and
// a counter name to read out) that a shared signature would fit neither well.
//
//   1. Android WebView native TTS  (window.AndroidTTS)  — the kiosk shell
//   2. Web Speech API + a WebAudio chime                — desktop/TV browsers
//   3. Chime only                                       — no speech available

export interface AnnounceInput {
  tokenCode: string
  counterEn: string
  counterAr: string
  lang: AnnouncementLang
  templateEn: string
  templateAr: string
}

// Speech engines read "A102" as a word, and a bare number as a cardinal
// ("one hundred and two"). Spell the prefix letters and read the digits
// separately so it survives a noisy lobby.
export function spellToken(code: string): string {
  const match = code.match(/^([A-Za-z]*)(\d*)$/)
  if (!match) return code.split('').join(', ')
  const [, letters, digits] = match
  const spelledLetters = letters.split('').join(', ')
  const spelledDigits = digits.length >= 3 ? digits.split('').join(', ') : digits
  return [spelledLetters, spelledDigits].filter(Boolean).join(', ')
}

// Arabic TTS reads a Latin letter unpredictably (often skipping it), so the
// prefix is transliterated into Arabic letter names for the Arabic utterance.
const ARABIC_LETTER_NAMES: Record<string, string> = {
  A: 'أيه', B: 'بي', C: 'سي', D: 'دي', E: 'إي', F: 'إف', G: 'جي', H: 'إتش',
  I: 'آي', J: 'جيه', K: 'كيه', L: 'إل', M: 'إم', N: 'إن', O: 'أو', P: 'بي',
  Q: 'كيو', R: 'آر', S: 'إس', T: 'تي', U: 'يو', V: 'في', W: 'دبليو',
  X: 'إكس', Y: 'واي', Z: 'زد',
}

export function spellTokenArabic(code: string): string {
  const match = code.match(/^([A-Za-z]*)(\d*)$/)
  if (!match) return code
  const [, letters, digits] = match
  const spelled = letters
    .toUpperCase()
    .split('')
    .map((ch) => ARABIC_LETTER_NAMES[ch] ?? ch)
    .join(' ')
  const spelledDigits = digits.length >= 3 ? digits.split('').join('، ') : digits
  return [spelled, spelledDigits].filter(Boolean).join(' ')
}

function fill(template: string, token: string, counter: string): string {
  return template.replace(/\{token\}/g, token).replace(/\{counter\}/g, counter)
}

export class SchoolAnnouncer {
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

  announce({ tokenCode, counterEn, counterAr, lang, templateEn, templateAr }: AnnounceInput) {
    if (typeof window === 'undefined') return

    const enText = fill(templateEn, spellToken(tokenCode), counterEn)
    const arText = fill(templateAr, spellTokenArabic(tokenCode), counterAr || counterEn)

    if ('AndroidTTS' in window) {
      const text =
        lang === 'ar' ? arText : lang === 'both' ? `${enText} ${arText}` : enText
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
      const hasArabic = !!findVoice('ar-SA')
      if (lang === 'ar') {
        // No Arabic voice installed on this TV — English is better than silence.
        await speakOne(hasArabic ? arText : enText, hasArabic ? 'ar-SA' : 'en-US')
      } else if (lang === 'both') {
        await speakOne(enText, 'en-US')
        if (hasArabic && arText.trim()) await speakOne(arText, 'ar-SA')
      } else {
        await speakOne(enText, 'en-US')
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
