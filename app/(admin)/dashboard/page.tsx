"use client"

import { motion } from "framer-motion"
import { MetricCard } from "@/components/admin/MetricCard"
import { CurrentServingCard } from "@/components/admin/CurrentServingCard"
import { ActivityFeed } from "@/components/admin/ActivityFeed"
import { QueueTable } from "@/components/admin/QueueTable"
import { PageTransition } from "@/components/shared/PageTransition"
import { useQueueStore } from "@/store/queueStore"
import { staggerContainer } from "@/lib/animations"

export default function DashboardPage() {
  const { entries } = useQueueStore()

  const waiting = entries.filter((e) => e.status === "waiting").length
  const inProgress = entries.filter((e) => e.status === "in-progress").length
  const completed = entries.filter((e) => e.status === "completed").length
  const totalToday = entries.filter((e) => e.status !== "cancelled").length

  return (
    <PageTransition>
      <div className="space-y-6">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <MetricCard title="Total Today" value={totalToday} accent="blue" />
          <MetricCard title="Waiting" value={waiting} accent="amber" subtitle="In queue" />
          <MetricCard title="In Progress" value={inProgress} accent="default" subtitle="Being served" />
          <MetricCard title="Completed" value={completed} accent="emerald" subtitle="Today" />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <CurrentServingCard />
          </div>
          <div className="lg:col-span-2 min-h-80">
            <ActivityFeed />
          </div>
        </div>

        <QueueTable />
      </div>
    </PageTransition>
  )
}
