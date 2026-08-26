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
  /** Roll width in mm. QZ needs it explicitly; the browser path reads @page. */
  widthMm?: number
  /**
   * Print the html from an isolated iframe instead of the host document.
   * Under --kiosk-printing this is the difference between a job that spools
   * on its own and one that waits for the whole kiosk page to lay out.
   */
  printFrame?: boolean
}

/*
 * The native print dialog cannot be suppressed from script — that is a browser
 * guarantee, not an oversight. What this does is give the silent routes the
 * cleanest possible job: a document containing the receipt and nothing else,
 * with its own @page, so Chrome under --kiosk-printing (or Edge, or a kiosk
 * shell) sends it straight to the default printer with no preview to dismiss.
 */
async function printFromFrame(html: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) {
    frame.remove()
    window.print()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // A logo is re-fetched inside the frame, and printing before it decodes puts
  // an empty box on the ticket. Capped, because a print must never be the
  // thing that hangs: the number is already issued.
  await Promise.race([
    Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.onload = () => r()
              img.onerror = () => r()
            })
      )
    ),
    new Promise((r) => setTimeout(r, 1500)),
  ])

  const win = frame.contentWindow
  // Removing the frame while the job is still spooling cancels it in Safari
  // and older Chrome, so afterprint clears it, with a timer for the browsers
  // that never fire it.
  const cleanup = () => frame.remove()
  win.addEventListener('afterprint', () => setTimeout(cleanup, 250), { once: true })
  setTimeout(cleanup, 20000)

  win.focus()
  win.print()
}

/**
 * Returns "qz" when printed via QZ Tray (caller may clean up immediately),
 * or "dialog" when window.print() was used (caller should wait for afterprint event).
 */
export async function silentPrint(
  opts: SilentPrintOptions
): Promise<"qz" | "dialog"> {
  const {
    html, printerName = "", forceDialog = false, widthMm = 80, printFrame = false,
  } = opts

  if (!forceDialog) {
    const qzAvailable = await tryConnectQZ()
    if (qzAvailable && window.qz) {
      const printer = await resolvePrinter(printerName)
      if (printer) {
        const config = window.qz.configs.create(printer, {
          size: { width: widthMm, units: "mm" },
          margins: 0,
        })
        await window.qz.print(config, [
          { type: "pixel", format: "html", data: html },
        ])
        return "qz"
      }
    }
  }

  if (printFrame) {
    await printFromFrame(html)
    return "dialog"
  }

  window.print()
  return "dialog"
}

/**
 * Builds a self-contained HTML string for a thermal receipt.
 *
 * `page` is the raw @page size. Default keeps the 80 mm counter ticket's fixed
 * square; a roll that is cut to length passes an `auto` height instead.
 */
export function buildReceiptHtml(content: string, page = '80mm 80mm'): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${page}; margin: 0; }
  body { margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; color: #000; }
</style>
</head>
<body>${content}</body>
</html>`
}
