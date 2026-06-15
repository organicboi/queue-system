"use client"

import { useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QueueTable } from "@/components/admin/QueueTable"
import { QueueHealthBar } from "@/components/admin/QueueHealthBar"
import { CurrentServingCard } from "@/components/admin/CurrentServingCard"
import { PageTransition } from "@/components/shared/PageTransition"
import { useQueueStore } from "@/store/queueStore"
import { toast } from "sonner"

export default function QueueManagementPage() {
  const resetToDefaults = useQueueStore((s) => s.resetToDefaults)

  const handleReset = () => {
    resetToDefaults()
    toast.success("Queue reset to demo data")
  }

  const handleExport = () => {
    toast.info("Export feature coming soon!")
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Queue Management</h2>
            <p className="text-sm text-muted-foreground">Manage and monitor all queue entries</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Reset Demo
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <QueueHealthBar />
          <CurrentServingCard />
        </div>

        <QueueTable />
      </div>
    </PageTransition>
  )
}
