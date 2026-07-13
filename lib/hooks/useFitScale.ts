'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

// Shrink-to-fit for a single line of big display text (queue/bill numbers).
// Renders at its normal (large, CSS-driven) font-size and this only scales
// it down — via a measured `transform: scale()` on a plain wrapper — as far
// as needed to keep it inside the real container. Bill numbers (Call page)
// can run much longer than queue numbers and displays come in wildly
// different sizes, so this measures actual rendered geometry instead of
// trusting a static vw-based clamp() or an estimated character width.
//
// Apply the returned scale to a plain wrapper element around the text, not
// to the text element itself if that element already has its own
// Framer Motion `animate`/`variants` transform — Framer fully owns the
// `transform` style on the node it animates, and writing to it directly
// would fight that on every animation frame.
export function useFitScale(
  containerRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  value: string | number
): number {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const fit = () => {
      const containerWidth = container.clientWidth
      // scrollWidth reflects the element's own laid-out content size and is
      // unaffected by CSS transforms (ours or Framer's), so it's safe to
      // read regardless of any animation currently running on the text node.
      const textWidth = text.scrollWidth
      if (containerWidth <= 0 || textWidth <= 0) return

      const availableWidth = containerWidth * 0.94
      setScale(textWidth > availableWidth ? availableWidth / textWidth : 1)
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerRef, textRef, value])

  return scale
}
