"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Module-level singleton so the event is captured once across all hook instances
let _deferredPrompt: BeforeInstallPromptEvent | null = null
const _listeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>()

function notify(p: BeforeInstallPromptEvent | null) {
  _deferredPrompt = p
  _listeners.forEach((cb) => cb(p))
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    notify(e as BeforeInstallPromptEvent)
  })
  window.addEventListener("appinstalled", () => notify(null))
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    if (isInstalled) return

    setCanInstall(!!_deferredPrompt)

    const cb = (p: BeforeInstallPromptEvent | null) => setCanInstall(!!p)
    _listeners.add(cb)
    return () => { _listeners.delete(cb) }
  }, [])

  async function install() {
    if (!_deferredPrompt) return false
    await _deferredPrompt.prompt()
    const { outcome } = await _deferredPrompt.userChoice
    if (outcome === "accepted") notify(null)
    return outcome === "accepted"
  }

  return { canInstall, install }
}
