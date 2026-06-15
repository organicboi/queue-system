"use client"

import { motion } from "framer-motion"
import { staggerItem } from "@/lib/animations"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  trend?: string
  trendUp?: boolean
  subtitle?: string
  accent?: "default" | "blue" | "emerald" | "amber" | "red"
}

const accentMap = {
  default: "border-l-gray-300",
  blue: "border-l-blue-400",
  emerald: "border-l-emerald-500",
  amber: "border-l-amber-400",
  red: "border-l-red-400",
}

export function MetricCard({ title, value, trend, trendUp, subtitle, accent = "default" }: MetricCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        "bg-white border border-border rounded-md p-5 border-l-4",
        accentMap[accent]
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      {trend && (
        <p className={cn("mt-1 text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
          {trendUp ? "↑" : "↓"} {trend}
        </p>
      )}
    </motion.div>
  )
}
