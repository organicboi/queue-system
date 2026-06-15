"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useQueueStore } from "@/store/queueStore"
import { formatRelativeTime } from "@/lib/queueUtils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ActivityLog } from "@/lib/types"

const logDot: Record<ActivityLog["type"], string> = {
  completed: "bg-emerald-500",
  called: "bg-blue-500",
  joined: "bg-gray-400",
  cancelled: "bg-red-400",
}

export function ActivityFeed() {
  const activityLogs = useQueueStore((s) => s.activityLogs)

  return (
    <div className="bg-white border border-border rounded-md flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Activity Feed</h3>
        <span className="text-xs text-muted-foreground">{activityLogs.length} events</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-0.5">
          <AnimatePresence>
            {activityLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-start gap-3 rounded-sm px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", logDot[log.type])} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground leading-snug">{log.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(log.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {activityLogs.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
