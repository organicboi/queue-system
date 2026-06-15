"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ExternalLink, Trash2, CheckCheck } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useQueueStore } from "@/store/queueStore"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { QueueTypeBadge } from "@/components/shared/QueueTypeBadge"
import { ServiceTypeBadge } from "@/components/shared/ServiceTypeBadge"
import { formatTime } from "@/lib/queueUtils"
import { toast } from "sonner"
import type { QueueStatus } from "@/lib/types"

const statusFilters: { label: string; value: QueueStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Waiting", value: "waiting" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
]

interface QueueTableProps {
  compact?: boolean
}

export function QueueTable({ compact }: QueueTableProps) {
  const { entries, cancelEntry, completeCurrentEntry, currentServingNumber } = useQueueStore()
  const [filter, setFilter] = useState<QueueStatus | "all">("all")
  const [search, setSearch] = useState("")

  const filtered = entries
    .filter((e) => e.status !== "cancelled")
    .filter((e) => filter === "all" || e.status === filter)
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        String(e.queueNumber).includes(search) ||
        e.service.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.queueNumber - b.queueNumber)

  const handleComplete = (queueNumber: number) => {
    completeCurrentEntry()
    toast.success(`Queue #${queueNumber} marked as completed`)
  }

  const handleCancel = (queueNumber: number) => {
    cancelEntry(queueNumber)
    toast.error(`Queue #${queueNumber} cancelled`)
  }

  return (
    <div className="bg-white border border-border rounded-md overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-border">
        <h3 className="font-semibold text-sm shrink-0">Queue List</h3>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as QueueStatus | "all")} className="flex-1">
          <TabsList className="h-8">
            {statusFilters.map((f) => {
              const count = f.value === "all"
                ? entries.filter((e) => e.status !== "cancelled").length
                : entries.filter((e) => e.status === f.value).length
              return (
                <TabsTrigger key={f.value} value={f.value} className="text-xs px-2.5 h-7">
                  {f.label}
                  <span className="ml-1 text-[10px] text-muted-foreground">({count})</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs w-full sm:w-44"
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/30">
              <TableHead className="text-xs w-14">#</TableHead>
              <TableHead className="text-xs">Customer</TableHead>
              {!compact && <TableHead className="text-xs">Service</TableHead>}
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              {!compact && <TableHead className="text-xs">Joined</TableHead>}
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {filtered.map((entry) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`border-b border-border transition-colors hover:bg-muted/20 ${
                    entry.status === "in-progress" ? "bg-blue-50/50" : ""
                  }`}
                >
                  <TableCell className="font-mono font-bold text-sm py-3">
                    {entry.queueNumber === currentServingNumber ? (
                      <span className="text-blue-600">{entry.queueNumber}</span>
                    ) : (
                      entry.queueNumber
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div>
                      <p className="text-sm font-medium">{entry.name}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.phone}</p>
                    </div>
                  </TableCell>
                  {!compact && (
                    <TableCell className="py-3">
                      <ServiceTypeBadge service={entry.service} />
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <QueueTypeBadge type={entry.type} />
                  </TableCell>
                  <TableCell className="py-3">
                    <StatusBadge status={entry.status} pulse />
                  </TableCell>
                  {!compact && (
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {formatTime(entry.joinedAt)}
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/track/${entry.trackingToken}`} target="_blank">
                        <Button variant="ghost" size="icon-xs" title="View tracking">
                          <ExternalLink className="size-3" />
                        </Button>
                      </Link>
                      {entry.status === "waiting" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleComplete(entry.queueNumber)}
                          title="Mark complete"
                        >
                          <CheckCheck className="size-3 text-emerald-600" />
                        </Button>
                      )}
                      {entry.status !== "completed" && entry.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCancel(entry.queueNumber)}
                          title="Cancel"
                        >
                          <Trash2 className="size-3 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No entries match the current filter.
        </div>
      )}
    </div>
  )
}
