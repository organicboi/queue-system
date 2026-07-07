/**
 * Silent thermal printing on Android via RawBT (https://rawbt.ru).
 *
 * QZ Tray only ships for Windows/Mac/Linux, so Android tablets can't use it.
 * RawBT is a print-service app that Bluetooth/USB/network-connects to ESC/POS
 * thermal printers. It's launched via an explicit Android intent (not
 * `window.print()`), so the OS print dialog never appears.
 *
 * The receipt is rasterized with html2canvas so the printed ticket matches
 * the on-screen/QZ receipt design exactly, then handed to RawBT as a base64
 * PNG through its documented intent scheme.
 */

const RAWBT_PACKAGE = "ru.a402d.rawbtprinter"

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Renders `el` to a PNG and hands it to RawBT to print, bypassing any
 * OS/browser print dialog.
 *
 * `el` is normally `display: none` (hidden on screen, only shown via a print
 * media query). html2canvas can't capture a `display: none` box, so this
 * temporarily adds a `rawbt-capturing` class — the caller's stylesheet must
 * define it to render the element off-screen (not display:none) — captures
 * it, then removes the class.
 */
export async function printViaRawBT(el: HTMLElement, targetWidthPx = 576): Promise<void> {
  const { default: html2canvas } = await import("html2canvas")

  el.classList.add("rawbt-capturing")
  try {
    const rect = el.getBoundingClientRect()
    const scale = rect.width > 0 ? targetWidthPx / rect.width : 2

    const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff" })
    const dataUrl = canvas.toDataURL("image/png")

    const intentUrl = `intent:${encodeURIComponent(dataUrl)}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`
    window.location.href = intentUrl
  } finally {
    el.classList.remove("rawbt-capturing")
  }
}
