/**
 * Silent print utility.
 *
 * Priority order:
 * 1. QZ Tray (requires QZ Tray desktop app + Java on the device) — truly silent, works on
 *    Windows/Mac desktops and Windows tablets.
 * 2. window.print() — silent when the browser is launched with --kiosk-printing (Chrome/Edge).
 *    Without that flag the OS print dialog appears.
 *
 * For Android tablets install "RawBT" or "PrintHand" and set them as the default
 * print destination in Chrome.
 */

declare global {
  interface Window {
    qz?: {
      websocket: { connect: () => Promise<void>; isActive: () => boolean }
      printers: { find: (name?: string) => Promise<string | string[]> }
      print: (
        config: unknown,
        data: Array<{ type: string; format: string; data: string }>
      ) => Promise<void>
      configs: { create: (printer: string, opts?: Record<string, unknown>) => unknown }
    }
  }
}

async function tryConnectQZ(): Promise<boolean> {
  if (typeof window === "undefined" || !window.qz) return false
  try {
    if (!window.qz.websocket.isActive()) {
      await window.qz.websocket.connect()
    }
    return window.qz.websocket.isActive()
  } catch {
    return false
  }
}

async function resolvePrinter(preferredName: string): Promise<string> {
  if (!window.qz) return ""
  try {
    if (preferredName) {
      const found = await window.qz.printers.find(preferredName)
      if (found) return Array.isArray(found) ? found[0] : found
    }
    const def = await window.qz.printers.find()
    return Array.isArray(def) ? def[0] : (def as string)
  } catch {
    return ""
  }
}

export interface SilentPrintOptions {
  /** Full HTML string (with inline styles) for the receipt */
  html: string
  /** Preferred printer name. Empty = OS default. */
  printerName?: string
  /** Skip QZ Tray and go straight to window.print() */
  forceDialog?: boolean
}

/**
 * Returns "qz" when printed via QZ Tray (caller may clean up immediately),
 * or "dialog" when window.print() was used (caller should wait for afterprint event).
 */
export async function silentPrint(
  opts: SilentPrintOptions
): Promise<"qz" | "dialog"> {
  const { html, printerName = "", forceDialog = false } = opts

  if (!forceDialog) {
    const qzAvailable = await tryConnectQZ()
    if (qzAvailable && window.qz) {
      const printer = await resolvePrinter(printerName)
      if (printer) {
        const config = window.qz.configs.create(printer, {
          size: { width: 80, units: "mm" },
          margins: 0,
        })
        await window.qz.print(config, [
          { type: "pixel", format: "html", data: html },
        ])
        return "qz"
      }
    }
  }

  window.print()
  return "dialog"
}

/** Builds a self-contained HTML string for the 80 mm thermal receipt */
export function buildReceiptHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; color: #000; }
</style>
</head>
<body>${content}</body>
</html>`
}
