"use client"

import { useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, CheckCheck, PhoneCall, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { callEntryAction, cancelEntryAction, completeEntryAction, noShowEntryAction } from "@/lib/actions/queue"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatTime } from "@/lib/queueUtils"
import { toast } from "sonner"
import { useRealtimeQueue } from "@/lib/hooks/useRealtimeQueue"
import type { QueueEntryDTO, QueueStatus } from "@/lib/db/types"

const statusFilters: { label: string; value: QueueStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Waiting", value: "waiting" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "No-Show", value: "no-show" },
]

interface QueueTableProps {
  branchId: string
  initialEntries: QueueEntryDTO[]
  compact?: boolean
}

export function QueueTable({ branchId, initialEntries, compact }: QueueTableProps) {
  const { entries, currentServingNumber } = useRealtimeQueue(branchId, {
    entries: initialEntries,
    currentServingNumber: 0,
  })
  const [filter, setFilter] = useState<QueueStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [pending, startTransition] = useTransition()

  const filtered = entries
    .filter((e) => e.status !== "cancelled" || filter === "all" || filter === "cancelled")
    .filter((e) => filter === "all" || e.status === filter)
    .filter(
      (e) =>
        String(e.queueNumber).includes(search) ||
        e.billNumber.toLowerCase().includes(search.toLowerCase()) ||
        (e.customerName ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.queueNumber - b.queueNumber)

  function act(fn: () => Promise<{ error?: string }>, successMsg?: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast.error(result.error)
      else if (successMsg) toast.success(successMsg)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-border">
        <h3 className="text-sm font-semibold shrink-0">All Entries</h3>
        <div className="flex flex-1 items-center gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as QueueStatus | "all")}>
            <TabsList className="h-8">
              {statusFilters.map((f) => {
                const count = f.value === "all"
                  ? entries.filter((e) => e.status !== "cancelled").length
                  : entries.filter((e) => e.status === f.value).length
                return (
                  <TabsTrigger key={f.value} value={f.value} className="text-xs px-2.5 h-7">
                    {f.label} <span className="ml-1 text-[10px] text-muted-foreground">({count})</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search queue # or bill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs w-full sm:w-48 ml-auto"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/30">
              <TableHead className="text-xs w-16">Queue #</TableHead>
              <TableHead className="text-xs">Bill</TableHead>
              {!compact && <TableHead className="text-xs">Customer</TableHead>}
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
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`border-b border-border transition-colors hover:bg-muted/20 ${
                    entry.status === "in-progress" ? "bg-teal-50/50" : ""
                  }`}
                >
                  <TableCell className="font-mono font-black text-base py-3">
                    <span className={entry.queueNumber === currentServingNumber ? "text-teal-600" : ""}>
                      #{entry.queueNumber}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="font-mono text-sm font-medium">{entry.billNumber}</span>
                  </TableCell>
                  {!compact && (
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {entry.customerName ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <StatusBadge status={entry.status} pulse={entry.status === "in-progress"} />
                  </TableCell>
                  {!compact && (
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {formatTime(entry.joinedAt)}
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      {(entry.status === "waiting" || entry.status === "in-progress") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                          onClick={() => act(
                            () => callEntryAction(entry.id, branchId),
                            `Queue #${entry.queueNumber} called`
                          )}
                          disabled={pending}
                        >
                          <PhoneCall className="size-3 mr-1" />
                          {entry.status === "in-progress" ? "Recall" : "Call"}
                        </Button>
                      )}
                      {entry.status === "in-progress" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                          onClick={() => act(
                            () => noShowEntryAction(entry.id, branchId),
                            `Queue #${entry.queueNumber} marked no-show`
                          )}
                          disabled={pending}
                        >
                          <UserX className="size-3" />
                        </Button>
                      )}
                      {entry.status !== "completed" && entry.status !== "cancelled" && entry.status !== "no-show" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => act(
                            () => completeEntryAction(entry.id, branchId),
                            `Queue #${entry.queueNumber} completed`
                          )}
                          disabled={pending}
                        >
                          <CheckCheck className="size-3" />
                        </Button>
                      )}
                      {entry.status !== "completed" && entry.status !== "cancelled" && entry.status !== "no-show" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => act(
                            () => cancelEntryAction(entry.id, branchId),
                            `Queue #${entry.queueNumber} cancelled`
                          )}
                          disabled={pending}
                        >
                          <Trash2 className="size-3" />
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
