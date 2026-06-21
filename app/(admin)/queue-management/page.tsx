"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QueueTable } from "@/components/admin/QueueTable"
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

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Queue Management</h2>
            <p className="text-sm text-muted-foreground">Manage all active queue entries</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Reset Demo
          </Button>
        </div>

        <CurrentServingCard />
        <QueueTable />
      </div>
    </PageTransition>
  )
}
