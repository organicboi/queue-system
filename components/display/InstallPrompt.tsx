"use client"

import { useState } from "react"
import { usePWAInstall } from "@/hooks/usePWAInstall"

export function InstallPrompt() {
  const { canInstall, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)

  async function handleInstall() {
    const accepted = await install()
    if (accepted) setDismissed(true)
  }

  if (!canInstall || dismissed) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3.5 rounded-2xl"
      style={{
        backgroundColor: "#0B1120",
        border: "1px solid #1E293B",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        minWidth: "320px",
      }}
    >
      {/* Icon */}
      <div
        className="shrink-0 flex items-center justify-center rounded-xl size-10"
        style={{ backgroundColor: "#6366F1" }}
      >
        <svg viewBox="0 0 24 24" className="size-5 text-white fill-white">
          <rect x="2" y="3" width="20" height="14" rx="2" fill="white" opacity="0.9"/>
          <rect x="3.5" y="4.5" width="17" height="11" rx="1.2" fill="#6366F1"/>
          <text x="12" y="13" fontSize="7" fontWeight="900" fill="white" textAnchor="middle">3</text>
          <polygon points="9,17 15,17 13.5,20.5 10.5,20.5" fill="white" opacity="0.9"/>
          <rect x="8" y="20.5" width="8" height="1.2" rx="0.6" fill="white" opacity="0.9"/>
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1">
        <p className="font-black text-white leading-none" style={{ fontSize: "0.875rem" }}>
          Install VibeQueue
        </p>
        <p className="text-slate-400 mt-0.5 leading-none" style={{ fontSize: "0.72rem" }}>
          Add to home screen for instant access
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-500 hover:text-slate-300 transition-colors px-1"
          style={{ fontSize: "0.75rem" }}
          aria-label="Dismiss"
        >
          ✕
        </button>
        <button
          onClick={handleInstall}
          className="px-4 py-2 rounded-xl font-black text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#6366F1", fontSize: "0.8rem" }}
        >
          Install
        </button>
      </div>
    </div>
  )
}
