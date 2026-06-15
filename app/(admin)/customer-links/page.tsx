"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ExternalLink, Copy, Check } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageTransition } from "@/components/shared/PageTransition"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { QueueTypeBadge } from "@/components/shared/QueueTypeBadge"
import { ServiceTypeBadge } from "@/components/shared/ServiceTypeBadge"
import { useQueueStore } from "@/store/queueStore"
import { generateTrackingUrl, formatTime } from "@/lib/queueUtils"
import { staggerContainer, staggerItem } from "@/lib/animations"
import { toast } from "sonner"

export default function CustomerLinksPage() {
  const entries = useQueueStore((s) => s.entries)
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const active = entries
    .filter((e) => e.status !== "cancelled" && e.status !== "completed")
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        String(e.queueNumber).includes(search)
    )
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const handleCopy = async (entry: typeof entries[0]) => {
    const url = generateTrackingUrl(entry.trackingToken)
    await navigator.clipboard.writeText(url)
    setCopiedId(entry.id)
    toast.success(`Tracking link copied for ${entry.name}`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Customer Links</h2>
            <p className="text-sm text-muted-foreground">
              Share tracking links with active customers — {active.length} active
            </p>
          </div>
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
        </div>

        {active.length === 0 ? (
          <div className="bg-white border border-border rounded-md py-20 text-center">
            <p className="text-sm text-muted-foreground">No active customers to show</p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {active.map((entry) => {
              const url = generateTrackingUrl(entry.trackingToken)
              return (
                <motion.div
                  key={entry.id}
                  variants={staggerItem}
                  className="bg-white border border-border rounded-md p-4 space-y-3 hover:border-gray-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">#{entry.queueNumber}</span>
                        <StatusBadge status={entry.status} pulse />
                      </div>
                      <p className="font-semibold text-sm mt-1">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.phone}</p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatTime(entry.joinedAt)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <ServiceTypeBadge service={entry.service} />
                    <QueueTypeBadge type={entry.type} />
                  </div>

                  <div className="rounded-sm bg-muted/40 border border-border p-2">
                    <p className="text-[10px] text-muted-foreground truncate">{url}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => handleCopy(entry)}
                    >
                      {copiedId === entry.id ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedId === entry.id ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      asChild
                    >
                      <Link href={`/track/${entry.trackingToken}`} target="_blank">
                        <ExternalLink className="size-3" />
                        Open
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </PageTransition>
  )
}
