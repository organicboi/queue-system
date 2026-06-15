import { cn } from "@/lib/utils"
import type { ServiceType } from "@/lib/types"

interface ServiceTypeBadgeProps {
  service: ServiceType
  className?: string
}

const serviceColor: Record<ServiceType, string> = {
  "Food Order": "text-orange-700 bg-orange-50 border-orange-200",
  "Consultation": "text-cyan-700 bg-cyan-50 border-cyan-200",
  "Repair Service": "text-rose-700 bg-rose-50 border-rose-200",
  "Document Verification": "text-teal-700 bg-teal-50 border-teal-200",
}

export function ServiceTypeBadge({ service, className }: ServiceTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        serviceColor[service],
        className
      )}
    >
      {service}
    </span>
  )
}
