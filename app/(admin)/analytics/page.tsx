"use client"

import { motion } from "framer-motion"
import { MetricCard } from "@/components/admin/MetricCard"
import { HourlyVolumeChart } from "@/components/admin/HourlyVolumeChart"
import { OrdersTrendChart } from "@/components/admin/OrdersTrendChart"
import { StatusBreakdownChart } from "@/components/admin/StatusBreakdownChart"
import { PageTransition } from "@/components/shared/PageTransition"
import { useQueueStore } from "@/store/queueStore"
import { staggerContainer } from "@/lib/animations"
import { formatDuration } from "@/lib/queueUtils"

export default function AnalyticsPage() {
  const entries = useQueueStore((s) => s.entries)

  const completed = entries.filter((e) => e.status === "completed")
  const cancelled = entries.filter((e) => e.status === "cancelled")
  const totalServed = completed.length
  const abandonRate = entries.length > 0
    ? Math.round((cancelled.length / entries.length) * 100)
    : 0

  const avgWaitMins = 8
  const peakHour = "12:00 PM"
  const completionRate = entries.filter((e) => e.status !== "cancelled").length > 0
    ? Math.round((totalServed / entries.filter((e) => e.status !== "cancelled").length) * 100)
    : 0

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Metric cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <MetricCard
            title="Total Served Today"
            value={totalServed}
            accent="blue"
            trend="+12% vs yesterday"
            trendUp
          />
          <MetricCard
            title="Avg Wait Time"
            value={formatDuration(avgWaitMins)}
            accent="default"
            subtitle="Per customer"
          />
          <MetricCard
            title="Completion Rate"
            value={`${completionRate}%`}
            accent="emerald"
            trend="Target: 85%"
            trendUp={completionRate >= 85}
          />
          <MetricCard
            title="Abandonment Rate"
            value={`${abandonRate}%`}
            accent="amber"
            subtitle="Cancelled/Total"
          />
        </motion.div>

        {/* Peak hour + longest wait */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-border rounded-md p-4 col-span-2"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Peak Queue Hour</p>
            <p className="text-2xl font-bold mt-1">{peakHour}</p>
            <p className="text-xs text-muted-foreground mt-0.5">22 customers in peak hour</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white border border-border rounded-md p-4 col-span-2"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Longest Wait Today</p>
            <p className="text-2xl font-bold mt-1">{formatDuration(24)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Queue #14 — Document Verification</p>
          </motion.div>
        </div>

        {/* Charts */}
        <HourlyVolumeChart />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <OrdersTrendChart />
          <StatusBreakdownChart />
        </div>
      </div>
    </PageTransition>
  )
}
