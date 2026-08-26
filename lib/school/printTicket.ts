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

// 57 mm roll. The head is 384 dots across (48 mm of printable area at 203 dpi),
// so that is what the capture is rasterised to — RawBT stretches the bitmap to
// the head's width regardless, and matching it keeps the ticket from being
// resampled.
//
// Width is the only dimension the paper fixes; the roll is cut to length, so
// height is whatever the ticket comes to, with a 100 mm floor so a short
// ticket still keeps its usual shape and tear offset.
export const SCHOOL_PAPER = { widthMm: 57, minHeightMm: 100, rawbtDots: 384 } as const

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
  return `${SCHOOL_PAPER.widthMm}mm ${heightMm}mm`
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
      widthMm: SCHOOL_PAPER.widthMm,
      printFrame: true,
    })
    return method === 'qz' ? 'qz' : 'dialog'
  } catch {
    return 'failed'
  }
}
