"use client"

import { motion } from "framer-motion"
import { MetricCard } from "@/components/admin/MetricCard"
import { QueueHealthBar } from "@/components/admin/QueueHealthBar"
import { CurrentServingCard } from "@/components/admin/CurrentServingCard"
import { ActivityFeed } from "@/components/admin/ActivityFeed"
import { QueueTable } from "@/components/admin/QueueTable"
import { PageTransition } from "@/components/shared/PageTransition"
import { useQueueStore } from "@/store/queueStore"
import { staggerContainer } from "@/lib/animations"
import { estimateWait, formatDuration } from "@/lib/queueUtils"

export default function DashboardPage() {
  const { entries, currentServingNumber, activityLogs } = useQueueStore()

  const totalToday = entries.filter((e) => e.status !== "cancelled").length
  const waiting = entries.filter((e) => e.status === "waiting").length
  const inProgress = entries.filter((e) => e.status === "in-progress").length
  const completed = entries.filter((e) => e.status === "completed").length
  const avgWait = formatDuration(estimateWait(waiting > 0 ? Math.round(waiting / 2) : 0))

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Metrics */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <MetricCard
            title="Total Today"
            value={totalToday}
            accent="blue"
            trend="vs yesterday"
            trendUp
          />
          <MetricCard
            title="Waiting"
            value={waiting}
            accent="amber"
            subtitle="In queue"
          />
          <MetricCard
            title="In Progress"
            value={inProgress}
            accent="default"
            subtitle="Being served"
          />
          <MetricCard
            title="Completed"
            value={completed}
            accent="emerald"
            subtitle="Today"
          />
        </motion.div>

        {/* Middle row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: health + current serving */}
          <div className="space-y-4 lg:col-span-1">
            <QueueHealthBar />
            <CurrentServingCard />

            {/* Avg wait */}
            <div className="bg-white border border-border rounded-md p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Avg Wait Time</p>
              <p className="text-2xl font-bold mt-1">{avgWait}</p>
            </div>
          </div>

          {/* Right: activity feed */}
          <div className="lg:col-span-2 min-h-80">
            <ActivityFeed />
          </div>
        </div>

        {/* Queue table */}
        <QueueTable />
      </div>
    </PageTransition>
  )
}
