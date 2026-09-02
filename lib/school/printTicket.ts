'use client'

import { silentPrint, buildReceiptHtml } from '@/lib/silentPrint'

// School-local print path.
//
// This does NOT reuse lib/rawbtPrint.ts, for one specific reason: that helper
// calls html2canvas without `useCORS`. The business ticket gets away with it
// because its logo is same-origin (/tech-logo.png), but a school logo comes
// from Supabase Storage — a cross-origin image taints the canvas, and the
// ticket then prints with the logo missing or the capture throws outright.
// Everything else about the RawBT intent path is copied as-is.
const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter'

/*
 * 58 mm roll on a 203 dpi head: 8 dots/mm, 384 dots across.
 *
 * Two widths, and the difference matters. `paperMm` is the roll — what the
 * @page is cut to. `printableMm` is the 384 dots the head can actually reach,
 * and it is what the ticket is laid out in, because RawBT stretches whatever
 * bitmap it gets to exactly those 384 dots. Designing at the printable width
 * makes that stretch a 1:1 copy: 1 mm on screen is 8 dots is 1 mm of paper, so
 * a 100 mm ticket comes out 100 mm and 40pt type prints at 40pt. Laid out at
 * the roll's 58 mm instead, every dimension would land at 48/58 of its value.
 *
 * Height is free — the roll is cut to length — so the ticket is exactly as
 * long as its content plus the trailing feed the tear bar needs. The floor is
 * only a guard against a degenerate measurement, not a shape: a 100 mm floor
 * on 46 mm of content is 54 mm of blank paper per visitor.
 */
export const SCHOOL_PAPER = {
  paperMm: 58,
  printableMm: 48,
  minHeightMm: 40,
  rawbtDots: 384,
  // Blank paper printed after the last line so it clears the tear bar. Drop it
  // to ~2 when an auto-cutter is doing the work — RawBT's own "lines
  // scrolling" feed already advances the paper past the blade, and the two
  // stack up into a long blank tail.
  tearFeedMm: 12,
} as const

// The logo's box on the ticket. Constrained on both axes so a wide wordmark
// and a square crest each end up as large as they can be without crowding the
// number, instead of a fixed width that squeezes one of the two.
const LOGO_MAX_MM = { width: 32, height: 14 }
// Anything darker than this fraction of white becomes a dot. Chosen for
// logos, which are flat shapes: a hard threshold keeps edges crisp where
// dithering would turn a small crest into grey noise.
const LOGO_THRESHOLD = 0.62

/*
 * The line the visitor is actually looking for: how many people are still in
 * front of them. Kept here beside the ticket geometry so the browser kiosk and
 * the Flutter kiosk print the same wording (the Dart twin lives in
 * mobile/kiosk/lib/src/printing/ticket_widget.dart).
 *
 * Arabic is phrased as a count ("the number of people waiting before you") on
 * purpose: it takes any number without the singular/dual/plural agreement a
 * "N people" phrasing would need.
 */
export function waitingAheadLine(count: number): { en: string; ar: string } {
  if (count <= 0) return { en: 'You are next in line', ar: 'أنت التالي في الطابور' }
  return {
    en: count === 1 ? '1 person waiting before you' : `${count} people waiting before you`,
    ar: `عدد المنتظرين قبلك: ${count}`,
  }
}

export interface TicketLogo {
  /** A 1-bit PNG, sized to the exact dot count it will print at. */
  src: string
  widthMm: number
}

/*
 * The QR on the ticket — see supabase/migrations/20260902_school_public_tracking.sql
 * and app/(public)/t/[code].
 *
 * Sized at 26mm and ECC level M (was 22mm/H — a real Flutter-kiosk ticket
 * came back unscannable). On a ~45-char URL, H forces a 37-module code where
 * 22mm/8dots-per-mm works out to under 0.6mm per module — too dense for a
 * phone camera on thermal paper. M needs meaningfully fewer modules (33 for
 * the same length) and isn't buying much anyway on a clean digital→print
 * path with no embedded logo to protect against; 26mm on top of that clears
 * ~0.8mm/module, comfortably inside typical scan-reliability guidance.
 */
export const QR_TARGET_MM = 26
export const QR_SOURCE_PX = 300
const QR_THRESHOLD = 0.62

export function qrCaptionLine(): { en: string; ar: string } {
  return { en: 'Scan to track your turn', ar: 'امسح لمتابعة دورك' }
}

/*
 * Renders the school logo the way the printer will actually reproduce it.
 *
 * A thermal head has one bit per dot: it fires or it doesn't. Handing it a
 * full-colour, anti-aliased PNG means RawBT does the conversion, and every
 * mid-tone in the artwork — gradients, soft edges, a coloured crest — lands on
 * the wrong side of its threshold at once, which is how a detailed logo prints
 * as a solid black blob.
 *
 * So the conversion happens here instead, and at exactly the resolution the
 * dots land on: the logo occupies `widthMm × 8` dots of the 384-dot head, so a
 * bitmap of exactly that many pixels is drawn 1:1 into the html2canvas capture
 * and reaches the printer un-resampled. Generate it any smaller and the
 * capture's upscale re-introduces the grey edges this exists to remove.
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

    const dpmm = SCHOOL_PAPER.rawbtDots / SCHOOL_PAPER.printableMm
    const w = Math.max(1, Math.round(widthMm * dpmm))
    const h = Math.max(1, Math.round(w * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    // Composite onto white first: a transparent PNG's alpha would otherwise
    // read as luminance 0 and print as a solid black plate.
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
    // A tainted canvas or a dead URL: the caller falls back to the original
    // image, which is what printed before this existed.
    return null
  }
}

/*
 * Turns a live <QRCodeCanvas> (qrcode.react) into the same kind of crisp
 * 1-bit PNG prepareTicketLogo produces, at exactly QR_TARGET_MM.
 *
 * Do NOT put <QRCodeCanvas>/<QRCodeSVG> directly in the ticket's printable
 * DOM: it would be picked up by the whole-ticket html2canvas capture (or the
 * browser's own scaled drawImage of a <canvas> source) at a fractional
 * scale, and its module edges — hard-edged vector fills — would come out
 * anti-aliased into grey, which is precisely the failure this avoids for the
 * logo. So the QR is rendered once into an off-DOM-visible scratch
 * <QRCodeCanvas> (kept mounted in the kiosk, re-rendered per ticket since the
 * URL differs every time), and this function reads it back with smoothing
 * disabled — a hard nearest-neighbour resample — then applies the same
 * luminance threshold as the logo to erase any residual fringe from the
 * source canvas's own anti-aliasing. What lands in the ticket is a plain
 * `<img>`, exactly like the logo.
 */
export function prepareTicketQr(source: HTMLCanvasElement): TicketLogo | null {
  try {
    const dpmm = SCHOOL_PAPER.rawbtDots / SCHOOL_PAPER.printableMm
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
    // The ticket prints without the QR rather than not printing at all.
    return null
  }
}

const PAGE_STYLE_ID = 'school-page-size'

/*
 * @page has no `auto` for one axis — `size: 57mm auto` is invalid and Chrome
 * drops the whole declaration, which lands the ticket on A4. So the length is
 * measured off the laid-out ticket and written as a real value, per job.
 *
 * The measurement borrows the RawBT capture class: the node is display:none
 * until then, and a hidden box has no height to read.
 */
function measurePageMm(el: HTMLElement): string {
  let heightMm: number = SCHOOL_PAPER.minHeightMm
  el.classList.add('rawbt-capturing')
  try {
    const px = el.getBoundingClientRect().height
    if (px > 0) heightMm = Math.max(SCHOOL_PAPER.minHeightMm, Math.ceil((px * 25.4) / 96))
  } finally {
    el.classList.remove('rawbt-capturing')
  }
  return `${SCHOOL_PAPER.paperMm}mm ${heightMm}mm`
}

// window.print() prints the kiosk document itself, so that document's @page is
// what the dialog path obeys — hence a style tag rather than a prop.
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

  // html2canvas can't capture a display:none box, so the caller's stylesheet
  // moves the element off-screen under this class instead.
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
// kiosk, so a printer problem must not turn into a visitor with no number.
export async function printSchoolTicket(
  el: HTMLElement,
  { silentPrintEnabled, printerName }: PrintTicketOptions
): Promise<'rawbt' | 'qz' | 'dialog' | 'failed'> {
  try {
    // Android goes to RawBT unconditionally — the branch's silent-print flag
    // does not gate it. A lobby kiosk is unattended: there is nobody standing
    // at it to dismiss an OS print dialog, so falling back to one would leave
    // the ticket unprinted AND the screen stuck on a modal for the next
    // visitor. RawBT prints a bitmap, so it needs no page size — only the
    // aspect ratio the capture already carries.
    if (isAndroid()) {
      await printViaRawBT(el, SCHOOL_PAPER.rawbtDots)
      return 'rawbt'
    }
    const page = measurePageMm(el)
    applyPageSize(page)
    const html = buildReceiptHtml(el.innerHTML, page)
    const method = await silentPrint({
      html,
      printerName,
      forceDialog: !silentPrintEnabled,
      widthMm: SCHOOL_PAPER.paperMm,
      printFrame: true,
    })
    return method === 'qz' ? 'qz' : 'dialog'
  } catch {
    return 'failed'
  }
}
