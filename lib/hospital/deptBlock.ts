/**
 * A department colour, resolved into a card that can actually be read.
 *
 * The kiosk's department grid paints a whole card in the colour an admin
 * picked in a web colour field, and sets everything else on top of it — so
 * that colour has to survive being a background. Two outcomes, decided by the
 * colour's own brightness, never by overruling the hue they chose:
 *
 * * **Dark block, white ink.** The common case. The colour is walked down in
 *   lightness until white clears roughly 4.5:1 on it.
 * * **Light block, dark ink.** A pastel or a highlighter yellow can't carry
 *   white at any lightness worth keeping — darkening one until it could would
 *   hand back a muddy olive, which is not the colour the hospital chose. So
 *   the card keeps its brightness and the type inverts instead.
 *
 * This is the TypeScript twin of `departmentBlock` in
 * mobile/kiosk/lib/src/ui/dept_icon.dart — the web kiosk and the Flutter kiosk
 * must resolve the same hex to the same card, or the same department reads as
 * two different colours on two terminals in the same lobby. Keep them in step.
 */
export interface DeptBlock {
  /** The fill to paint the card with. */
  fill: string
  /** The single ink that goes on top of it. */
  on: string
  /** True when the fill kept its brightness and the ink inverted to dark. */
  light: boolean
  /** The same fill one step deeper, for the moment a finger is on the card. */
  pressed: string
  /** Ink at the alpha the secondary line uses — muted, still legible. */
  onSoft: string
  /** A translucent wash of the ink, for tiles and chips laid on the fill. */
  onWash: string
}

interface Hsl {
  h: number
  s: number
  l: number
}

const FALLBACK = '#2F5BEA'

function parseHex(hex: string): [number, number, number] {
  const clean = (hex ?? '').replace('#', '').trim()
  const source = /^[0-9a-fA-F]{6}$/.test(clean) ? clean : FALLBACK.slice(1)
  return [
    parseInt(source.slice(0, 2), 16),
    parseInt(source.slice(2, 4), 16),
    parseInt(source.slice(4, 6), 16),
  ]
}

/** WCAG relative luminance — the same curve Flutter's computeLuminance uses. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function toHsl([r, g, b]: [number, number, number]): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
      : max === gn
        ? ((bn - rn) / d + 2) * 60
        : ((rn - gn) / d + 4) * 60
  return { h, s, l }
}

function toRgb({ h, s, l }: Hsl): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [
    Math.round(channel(h / 360 + 1 / 3) * 255),
    Math.round(channel(h / 360) * 255),
    Math.round(channel(h / 360 - 1 / 3) * 255),
  ]
}

const hex = (rgb: [number, number, number]) =>
  `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The same fill one step deeper. */
function deepen(hsl: Hsl, by = 0.06): Hsl {
  return { ...hsl, l: clamp01(hsl.l - by) }
}

// The same handful of department colours are re-resolved on every feed poll.
const cache = new Map<string, DeptBlock>()

export function departmentBlock(rawHex: string): DeptBlock {
  const key = rawHex ?? ''
  const hit = cache.get(key)
  if (hit) return hit

  const rgb = parseHex(key)
  let hsl = toHsl(rgb)
  let block: DeptBlock

  if (luminance(rgb) > 0.42) {
    // Give a washed-out pastel enough saturation to read as a colour rather
    // than as dirty paper, and keep it bright.
    if (hsl.s < 0.35) hsl = { ...hsl, s: 0.35 }
    if (hsl.l < 0.62) hsl = { ...hsl, l: 0.62 }
    const ink = { h: hsl.h, s: Math.max(hsl.s, 0.5), l: 0.16 }
    const inkRgb = toRgb(ink)
    block = {
      fill: hex(toRgb(hsl)),
      on: hex(inkRgb),
      light: true,
      pressed: hex(toRgb(deepen(hsl))),
      onSoft: `rgb(${inkRgb.join(' ')} / 0.72)`,
      onWash: `rgb(${inkRgb.join(' ')} / 0.12)`,
    }
  } else {
    if (hsl.s < 0.25) hsl = { ...hsl, s: 0.25 }
    // 0.18 relative luminance puts white at ~4.6:1 — the AA threshold for the
    // small print on these cards, and far past it for the names.
    let guard = 0
    while (luminance(toRgb(hsl)) > 0.18 && hsl.l > 0.16 && guard++ < 24) {
      hsl = { ...hsl, l: clamp01(hsl.l - 0.03) }
    }
    block = {
      fill: hex(toRgb(hsl)),
      on: '#ffffff',
      light: false,
      pressed: hex(toRgb(deepen(hsl))),
      onSoft: 'rgb(255 255 255 / 0.76)',
      onWash: 'rgb(255 255 255 / 0.18)',
    }
  }

  cache.set(key, block)
  return block
}
