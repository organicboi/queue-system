"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/queueUtils"
import type { ActivityLogDTO } from "@/lib/db/types"

const logDot: Record<string, string> = {
  completed: "bg-accent-600",
  called:    "bg-accent-600",
  recalled:  "bg-amber-500",
  joined:    "bg-slate-400",
  cancelled: "bg-red-400",
  reset:     "bg-red-400",
  "kitchen-bypassed": "bg-amber-500",
}

interface ActivityFeedProps {
  logs: ActivityLogDTO[]
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border bg-white flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Activity Feed</h3>
        <span className="text-xs text-muted-foreground">{logs.length} events</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-0.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 active:bg-muted/40 transition-colors"
            >
              <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", logDot[log.type] ?? "bg-slate-400")} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground leading-snug">{log.message}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(log.createdAt)}
                </p>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
