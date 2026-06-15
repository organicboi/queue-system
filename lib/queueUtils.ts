import type { QueueStatus, QueueType } from "./types"

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

export function getStatusColor(status: QueueStatus): string {
  switch (status) {
    case "waiting":
      return "text-blue-700"
    case "in-progress":
      return "text-indigo-700"
    case "completed":
      return "text-emerald-700"
    case "cancelled":
      return "text-red-600"
  }
}

export function getStatusBg(status: QueueStatus): string {
  switch (status) {
    case "waiting":
      return "bg-blue-50 border-blue-200"
    case "in-progress":
      return "bg-indigo-50 border-indigo-200"
    case "completed":
      return "bg-emerald-50 border-emerald-200"
    case "cancelled":
      return "bg-red-50 border-red-200"
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
  }
}

export function getQueueTypeBg(type: QueueType): string {
  switch (type) {
    case "normal":
      return "bg-gray-100 border-gray-200 text-gray-600"
    case "priority":
      return "bg-amber-50 border-amber-200 text-amber-700"
    case "vip":
      return "bg-yellow-50 border-yellow-200 text-yellow-700"
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
