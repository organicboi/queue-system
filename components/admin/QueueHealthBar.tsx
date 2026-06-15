"use client"

import { useQueueStore } from "@/store/queueStore"
import { cn } from "@/lib/utils"

export function QueueHealthBar() {
  const entries = useQueueStore((s) => s.entries)
  const waitingCount = entries.filter((e) => e.status === "waiting").length

  const status =
    waitingCount <= 3
      ? { label: "Low Traffic", color: "text-emerald-600", bar: "bg-emerald-500" }
      : waitingCount <= 7
      ? { label: "Medium Traffic", color: "text-amber-600", bar: "bg-amber-400" }
      : { label: "High Traffic", color: "text-red-600", bar: "bg-red-500" }

  const pct = Math.min(100, Math.round((waitingCount / 15) * 100))

  return (
    <div className="bg-white border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Queue Health</p>
        <span className={cn("text-xs font-semibold", status.color)}>{status.label}</span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", status.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{waitingCount} waiting</span>
        <span>{pct}% capacity</span>
      </div>
    </div>
  )
}
