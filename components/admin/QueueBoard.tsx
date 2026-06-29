'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeQueue } from '@/lib/hooks/useRealtimeQueue'
import {
  callNextAction,
  callEntryAction,
  cancelEntryAction,
  completeEntryAction,
  resetQueueAction,
} from '@/lib/actions/queue'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatTime } from '@/lib/queueUtils'
import { PhoneCall, CheckCheck, Trash2, SkipForward, RotateCcw, Plus } from 'lucide-react'
import Link from 'next/link'
import type { QueueEntryDTO, QueueStatus } from '@/lib/db/types'

interface Props {
  branchId: string
  initialEntries: QueueEntryDTO[]
  initialServingNumber: number
}

type Filter = QueueStatus | 'all'

export function QueueBoard({ branchId, initialEntries, initialServingNumber }: Props) {
  const { entries, currentServingNumber } = useRealtimeQueue(branchId, {
    entries: initialEntries,
    currentServingNumber: initialServingNumber,
  })
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  const inProgress = entries.find((e) => e.status === 'in-progress')

  const filtered = entries
    .filter((e) => e.status !== 'cancelled' || filter === 'all')
    .filter((e) => filter === 'all' || e.status === filter)
    .filter(
      (e) =>
        String(e.queueNumber).includes(search) ||
        e.billNumber.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.queueNumber - b.queueNumber)

  function counts(s: QueueStatus | 'all') {
    if (s === 'all') return entries.length
    return entries.filter((e) => e.status === s).length
  }

  function act(fn: () => Promise<{ error?: string }>, successMsg?: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast.error(result.error)
      else if (successMsg) toast.success(successMsg)
    })
  }

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
        {/* Now serving */}
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Serving:</span>
          <span className="text-2xl font-black text-indigo-700 tabular-nums leading-none">
            {currentServingNumber > 0 ? `#${currentServingNumber}` : '—'}
          </span>
          {inProgress && (
            <span className="text-xs font-mono text-muted-foreground">Bill {inProgress.billNumber}</span>
          )}
        </div>

        <div className="flex-1" />

        <Button
          onClick={() => act(() => callNextAction(branchId))}
          disabled={pending || entries.filter((e) => e.status === 'waiting').length === 0}
          className="bg-primary hover:bg-primary/90 gap-1.5"
        >
          <SkipForward className="size-4" />
          Call Next
        </Button>

        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/add-customer">
            <Plus className="size-4" />
            Add Customer
          </Link>
        </Button>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500">
              <RotateCcw className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Queue</DialogTitle>
              <DialogDescription>
                This will cancel all waiting and in-progress entries and reset the counter to 1.
                This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setResetOpen(false)
                  act(() => resetQueueAction(branchId), 'Queue reset successfully')
                }}
              >
                Reset Queue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter + search */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 border-b border-border">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="h-8">
              {(['all', 'waiting', 'in-progress', 'completed'] as const).map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs px-2.5 h-7 capitalize">
                  {s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ml-1 text-[10px] text-muted-foreground">({counts(s)})</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="ml-auto">
            <Input
              placeholder="Search queue # or bill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-muted/20">
                <TableHead className="text-xs w-20">Queue #</TableHead>
                <TableHead className="text-xs">Bill / Ref</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Joined</TableHead>
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
                    className={`border-b border-border hover:bg-muted/20 transition-colors ${
                      entry.status === 'in-progress' ? 'bg-indigo-50/60' : ''
                    }`}
                  >
                    <TableCell className="py-3">
                      <span className={`font-mono font-black text-base tabular-nums ${
                        entry.queueNumber === currentServingNumber ? 'text-indigo-600' : 'text-gray-900'
                      }`}>
                        #{entry.queueNumber}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-sm font-medium">{entry.billNumber}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge status={entry.status} pulse={entry.status === 'in-progress'} />
                    </TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {formatTime(entry.joinedAt)}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(entry.status === 'waiting' || entry.status === 'in-progress') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => act(
                              () => callEntryAction(entry.id, branchId),
                              entry.status === 'in-progress'
                                ? `Queue #${entry.queueNumber} recalled`
                                : `Queue #${entry.queueNumber} called`
                            )}
                            disabled={pending}
                          >
                            <PhoneCall className="size-3 mr-1" />
                            {entry.status === 'in-progress' ? 'Recall' : 'Call'}
                          </Button>
                        )}
                        {entry.status !== 'completed' && entry.status !== 'cancelled' && (
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
                            <CheckCheck className="size-3 mr-1" />
                            Done
                          </Button>
                        )}
                        {entry.status !== 'completed' && entry.status !== 'cancelled' && (
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
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">No entries match the current filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
