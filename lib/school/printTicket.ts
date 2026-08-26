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

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
}

async function printViaRawBT(el: HTMLElement, targetWidthPx = 576): Promise<void> {
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
    if (silentPrintEnabled && isAndroid()) {
      await printViaRawBT(el)
      return 'rawbt'
    }
    const html = buildReceiptHtml(el.innerHTML)
    const method = await silentPrint({
      html,
      printerName,
      forceDialog: !silentPrintEnabled,
    })
    return method === 'qz' ? 'qz' : 'dialog'
  } catch {
    return 'failed'
  }
}
