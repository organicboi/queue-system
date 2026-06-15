import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
  glow?: boolean
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div className={cn("bg-white border border-border rounded-md p-4", className)}>
      {children}
    </div>
  )
}
