import { cn } from "@/lib/utils"
import { getStatusBg, getStatusColor, getStatusLabel } from "@/lib/queueUtils"
import type { QueueStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: QueueStatus
  pulse?: boolean
  className?: string
}

export function StatusBadge({ status, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getStatusBg(status),
        getStatusColor(status),
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "waiting" && "bg-blue-500",
          status === "in-progress" && "bg-indigo-500",
          status === "completed" && "bg-emerald-500",
          status === "cancelled" && "bg-red-400",
          pulse && status === "in-progress" && "animate-pulse"
        )}
      />
      {getStatusLabel(status)}
    </span>
  )
}
