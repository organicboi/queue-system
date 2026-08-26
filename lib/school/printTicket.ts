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
} as const

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
