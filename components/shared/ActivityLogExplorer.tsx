'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatTime, rangeToDates, ACTIVITY_LOG_PAGE_SIZE } from '@/lib/queueUtils'
import type { ActivityLogDTO, ActivityType } from '@/lib/db/types'

const TYPE_OPTIONS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'joined', label: 'Joined' },
  { value: 'called', label: 'Called' },
  { value: 'recalled', label: 'Recalled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no-show', label: 'No-show' },
  { value: 'reset', label: 'Reset' },
  { value: 'paused', label: 'Paused' },
  { value: 'resumed', label: 'Resumed' },
  { value: 'kitchen-bypassed', label: 'Kitchen bypassed' },
]

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const dotColor: Record<string, string> = {
  joined: 'bg-slate-400',
  called: 'bg-blue-500',
  recalled: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  'no-show': 'bg-orange-400',
  reset: 'bg-purple-400',
  paused: 'bg-yellow-400',
  resumed: 'bg-green-400',
  'kitchen-bypassed': 'bg-amber-500',
}

interface ExportFilters {
  type?: ActivityType | 'all'
  search?: string
  from?: string
  to?: string
  branchId?: string
}

interface ActivityLogExplorerProps {
  logs: ActivityLogDTO[]
  total: number
  page: number
  filters: { type: string; range: string; search: string }
  branches?: { id: string; name: string }[]
  selectedBranchId?: string
  exportAction: (filters: ExportFilters) => Promise<{ error?: string; csv?: string }>
  exportFileName: string
}

export function ActivityLogExplorer({
  logs, total, page, filters, branches, selectedBranchId, exportAction, exportFileName,
}: ActivityLogExplorerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(filters.search)
  const [isExporting, startExport] = useTransition()
  const [isPending, startNavigate] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE))

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!('page' in next)) params.delete('page')
    startNavigate(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    updateParams({ search: searchInput || undefined })
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p > 1) params.set('page', String(p))
    else params.delete('page')
    startNavigate(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  async function handleExport() {
    startExport(async () => {
      const result = await exportAction({
        type: filters.type as ActivityType | 'all',
        search: filters.search,
        branchId: selectedBranchId,
        ...rangeToDates(filters.range),
      })
      if (result.error || !result.csv) {
        toast.error(result.error ?? 'Failed to export logs')
        return
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-white p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search queue #, bill #, or message..."
              className="h-9 pl-8 text-xs"
            />
          </div>
        </form>

        {branches && (
          <Select
            value={selectedBranchId ?? 'all'}
            onValueChange={(v) => updateParams({ branchId: v === 'all' ? undefined : v })}
          >
            <SelectTrigger size="sm" className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.type} onValueChange={(v) => updateParams({ type: v === 'all' ? undefined : v })}>
          <SelectTrigger size="sm" className="w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.range} onValueChange={(v) => updateParams({ range: v === '7d' ? undefined : v })}>
          <SelectTrigger size="sm" className="w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={handleExport}
          disabled={isExporting || logs.length === 0}
        >
          <Download className="size-3.5" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Table */}
      <div className={cn('rounded-xl border border-border bg-white overflow-hidden transition-opacity', isPending && 'opacity-60')}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-muted/30">
                <TableHead className="text-xs w-24">Time</TableHead>
                <TableHead className="text-xs w-28">Type</TableHead>
                <TableHead className="text-xs">Message</TableHead>
                <TableHead className="text-xs w-20">Queue #</TableHead>
                <TableHead className="text-xs w-24">Bill #</TableHead>
                <TableHead className="text-xs w-20">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize">
                      <span className={cn('size-1.5 rounded-full shrink-0', dotColor[log.type] ?? 'bg-gray-400')} />
                      {log.type}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-foreground">{log.message}</TableCell>
                  <TableCell className="py-2.5 text-xs font-mono">
                    {log.queueNumber > 0 ? `#${log.queueNumber}` : '—'}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs font-mono">{log.billNumber || '—'}</TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground capitalize">{log.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {logs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No activity matches the current filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * ACTIVITY_LOG_PAGE_SIZE + 1}–{Math.min(page * ACTIVITY_LOG_PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isPending} onClick={() => goToPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isPending} onClick={() => goToPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
