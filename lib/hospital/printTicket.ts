'use client'

import { silentPrint, buildReceiptHtml } from '@/lib/silentPrint'
import type { Locale } from '@/lib/region'

// Hospital-local print path.
//
// This does NOT reuse lib/rawbtPrint.ts, for one specific reason: that helper
// calls html2canvas without `useCORS`. The business ticket gets away with it
// because its logo is same-origin, but a hospital logo comes from Supabase
// Storage — a cross-origin image taints the canvas, and the ticket then
// prints with the logo missing or the capture throws outright. Copied from
// lib/school/printTicket.ts, which already carries the fix.
const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter'

/*
 * 58 mm roll on a 203 dpi head: 8 dots/mm, 384 dots across. See the school
 * twin for the full reasoning on paperMm vs printableMm — same geometry.
 */
export const HOSPITAL_PAPER = {
  paperMm: 58,
  printableMm: 48,
  minHeightMm: 40,
  rawbtDots: 384,
  tearFeedMm: 12,
} as const

const LOGO_MAX_MM = { width: 32, height: 14 }
const LOGO_THRESHOLD = 0.62

/*
 * The line the patient is actually looking for: how many people are still in
 * front of them. Kept here beside the ticket geometry so the browser kiosk and
 * any future native kiosk print the same wording.
 */
export function waitingAheadLine(count: number): Record<Locale, string> {
  if (count <= 0) {
    return {
      en: 'You are next in line',
      ar: 'أنت التالي في الطابور',
      mr: 'तुमचा नंबर पुढे आहे',
      hi: 'अगली बारी आपकी है',
    }
  }
  return {
    en: count === 1 ? '1 person waiting before you' : `${count} people waiting before you`,
    ar: `عدد المنتظرين قبلك: ${count}`,
    mr: `तुमच्या आधी प्रतीक्षेत असलेले: ${count}`,
    hi: `आपसे पहले प्रतीक्षा में: ${count}`,
  }
}

export interface TicketLogo {
  /** A 1-bit PNG, sized to the exact dot count it will print at. */
  src: string
  widthMm: number
}

/*
 * The QR on the ticket — points at /t/[publicCode]. Sized at 26mm and ECC
 * level M: on a ~45-char URL, H forces a 37-module code too dense for a phone
 * camera on thermal paper. See the school twin for the full reasoning.
 */
export const QR_TARGET_MM = 26
export const QR_SOURCE_PX = 300
const QR_THRESHOLD = 0.62

export function qrCaptionLine(): Record<Locale, string> {
  return {
    en: 'Scan to track your turn',
    ar: 'امسح لمتابعة دورك',
    mr: 'तुमची बारी पाहण्यासाठी स्कॅन करा',
    hi: 'अपनी बारी देखने के लिए स्कैन करें',
  }
}

/*
 * Renders the hospital logo the way the printer will actually reproduce it:
 * composited onto white, thresholded to 1 bit, at exactly the dot resolution
 * it prints at. See the school twin for why (a colour logo prints as a black
 * blob if the printer does the conversion).
 */
export async function prepareTicketLogo(url: string): Promise<TicketLogo | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await img.decode()

    const natural = img.naturalWidth || 1
    const ratio = (img.naturalHeight || 1) / natural
    let widthMm = LOGO_MAX_MM.width
    if (widthMm * ratio > LOGO_MAX_MM.height) widthMm = LOGO_MAX_MM.height / ratio

    const dpmm = HOSPITAL_PAPER.rawbtDots / HOSPITAL_PAPER.printableMm
    const w = Math.max(1, Math.round(widthMm * dpmm))
    const h = Math.max(1, Math.round(w * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const frame = ctx.getImageData(0, 0, w, h)
    const px = frame.data
    for (let i = 0; i < px.length; i += 4) {
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
      const v = lum < LOGO_THRESHOLD ? 0 : 255
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
    ctx.putImageData(frame, 0, 0)

    return { src: canvas.toDataURL('image/png'), widthMm }
  } catch {
    return null
  }
}

/*
 * Turns a live <QRCodeCanvas> into the same kind of crisp 1-bit PNG
 * prepareTicketLogo produces, at exactly QR_TARGET_MM. Never put the canvas in
 * the printable DOM — its module edges would anti-alias into grey. See the
 * school twin.
 */
export function prepareTicketQr(source: HTMLCanvasElement): TicketLogo | null {
  try {
    const dpmm = HOSPITAL_PAPER.rawbtDots / HOSPITAL_PAPER.printableMm
    const target = Math.max(1, Math.round(QR_TARGET_MM * dpmm))

    const canvas = document.createElement('canvas')
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, target, target)
    ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, target, target)

    const frame = ctx.getImageData(0, 0, target, target)
    const px = frame.data
    for (let i = 0; i < px.length; i += 4) {
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
      const v = lum < QR_THRESHOLD ? 0 : 255
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
    ctx.putImageData(frame, 0, 0)

    return { src: canvas.toDataURL('image/png'), widthMm: QR_TARGET_MM }
  } catch {
    return null
  }
}

const PAGE_STYLE_ID = 'hospital-page-size'

function measurePageMm(el: HTMLElement): string {
  let heightMm: number = HOSPITAL_PAPER.minHeightMm
  el.classList.add('rawbt-capturing')
  try {
    const px = el.getBoundingClientRect().height
    if (px > 0) heightMm = Math.max(HOSPITAL_PAPER.minHeightMm, Math.ceil((px * 25.4) / 96))
  } finally {
    el.classList.remove('rawbt-capturing')
  }
  return `${HOSPITAL_PAPER.paperMm}mm ${heightMm}mm`
}

function applyPageSize(page: string): void {
  let tag = document.getElementById(PAGE_STYLE_ID)
  if (!tag) {
    tag = document.createElement('style')
    tag.id = PAGE_STYLE_ID
    document.head.appendChild(tag)
  }
  tag.textContent = `@page { size: ${page}; margin: 0; }`
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
}

async function printViaRawBT(el: HTMLElement, targetWidthPx: number): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')

  el.classList.add('rawbt-capturing')
  try {
    const rect = el.getBoundingClientRect()
    const scale = rect.width > 0 ? targetWidthPx / rect.width : 2

    const canvas = await html2canvas(el, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
    })
    const dataUrl = canvas.toDataURL('image/png')

    const intentUrl = `intent:${encodeURI(dataUrl)}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`
    window.location.href = intentUrl
  } finally {
    el.classList.remove('rawbt-capturing')
  }
}

export interface PrintTicketOptions {
  silentPrintEnabled: boolean
  printerName: string
}

// Never throws: the token is already committed server-side and shown on the
// kiosk, so a printer problem must not turn into a patient with no number.
export async function printHospitalTicket(
  el: HTMLElement,
  { silentPrintEnabled, printerName }: PrintTicketOptions
): Promise<'rawbt' | 'qz' | 'dialog' | 'failed'> {
  try {
    // Android goes to RawBT unconditionally — a lobby kiosk is unattended, so
    // there is nobody to dismiss an OS print dialog.
    if (isAndroid()) {
      await printViaRawBT(el, HOSPITAL_PAPER.rawbtDots)
      return 'rawbt'
    }
    const page = measurePageMm(el)
    applyPageSize(page)
    const html = buildReceiptHtml(el.innerHTML, page)
    const method = await silentPrint({
      html,
      printerName,
      forceDialog: !silentPrintEnabled,
      widthMm: HOSPITAL_PAPER.paperMm,
      printFrame: true,
    })
    return method === 'qz' ? 'qz' : 'dialog'
  } catch {
    return 'failed'
  }
}
