import { cn } from "@/lib/utils"
import { getQueueTypeBg } from "@/lib/queueUtils"
import type { QueueType } from "@/lib/types"

interface QueueTypeBadgeProps {
  type: QueueType
  className?: string
}

export function QueueTypeBadge({ type, className }: QueueTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        getQueueTypeBg(type),
        className
      )}
    >
      {type}
    </span>
  )
}
