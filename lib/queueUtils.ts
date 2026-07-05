import type { QueueStatus } from "./types"

export function estimateWait(position: number, avgServiceMinutes = 3): number {
  return position * avgServiceMinutes
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min"
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""}`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

// Design system v5, §2.5 — status pill map: waiting is the only amber
// state; in-progress and completed share one accent bucket ("done" reads
// the same whether it just happened or is happening now); cancelled and
// no-show share the neutral slate bucket (label text distinguishes which).
export function getStatusColor(status: QueueStatus): string {
  switch (status) {
    case "waiting":
      return "text-amber-700"
    case "in-progress":
      return "text-accent-700"
    case "completed":
      return "text-accent-700"
    case "cancelled":
      return "text-slate-500"
    case "no-show":
      return "text-slate-500"
  }
}

export function getStatusBg(status: QueueStatus): string {
  switch (status) {
    case "waiting":
      return "bg-amber-50 border-amber-200"
    case "in-progress":
      return "bg-accent-50 border-accent-200"
    case "completed":
      return "bg-accent-50 border-accent-200"
    case "cancelled":
      return "bg-slate-100 border-slate-200"
    case "no-show":
      return "bg-slate-100 border-slate-200"
  }
}

export function getStatusLabel(status: QueueStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting"
    case "in-progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    case "no-show":
      return "No Show"
  }
}

export function getSmartStatusMessage(position: number): string {
  if (position === 0) return "It's your turn now. Please proceed!"
  if (position === 1) return "Please be ready. You're next!"
  if (position <= 3) return "You're getting closer. Almost there!"
  if (position <= 5) return "You're getting near. Please stay close."
  return "You're in queue. We'll keep you updated."
}

export function generateTrackingUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/track/${token}`
  }
  return `http://localhost:3000/track/${token}`
}

// ── Activity log explorer ──────────────────────────────────────
export const ACTIVITY_LOG_PAGE_SIZE = 50

export function rangeToDates(range: string): { from?: string; to?: string } {
  const now = new Date()
  switch (range) {
    case "today": {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { from: start.toISOString() }
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    default:
      return {}
  }
}
