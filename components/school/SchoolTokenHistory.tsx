'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, formatTime, formatDuration } from '@/lib/queueUtils'
import { downloadTokensCsv } from '@/lib/school/exportCsv'
import { SCHOOL_TOKEN_PAGE_SIZE } from '@/lib/school/constants'
import type { SchoolDepartmentDTO, SchoolTokenDTO, SchoolTokenStatus } from '@/lib/db/school-types'

const STATUS_PILL: Record<SchoolTokenStatus, { label: string; className: string }> = {
  waiting:   { label: 'Waiting',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  held:      { label: 'On hold',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  called:    { label: 'Called',    className: 'bg-accent-50 text-accent-700 border-accent-200' },
  served:    { label: 'Served',    className: 'bg-accent-50 text-accent-700 border-accent-200' },
  'no-show': { label: 'No-show',   className: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

interface Props {
  departments: SchoolDepartmentDTO[]
  tokens: SchoolTokenDTO[]
  total: number
  page: number
  filters: { status?: string; departmentId?: string; search?: string; from?: string; to?: string }
}

export function SchoolTokenHistory({ departments, tokens, total, page, filters }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])
  const lastPage = Math.max(1, Math.ceil(total / SCHOOL_TOKEN_PAGE_SIZE))

  // Every filter is a URL parameter so a manager can bookmark or share the
  // exact view they're looking at.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    router.push(`/school/tokens?${next.toString()}`)
  }

  function waitFor(token: SchoolTokenDTO): string {
    if (!token.calledAt) return '—'
    const mins = Math.round(
      (new Date(token.calledAt).getTime() - new Date(token.joinedAt).getTime()) / 60000
    )
    return mins >= 0 ? formatDuration(mins) : '—'
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Token history</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} token{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadTokensCsv(tokens, deptById, 'school-tokens.csv')}
          disabled={tokens.length === 0}
        >
          <Download className="size-3.5" />
          Export this page
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          defaultValue={filters.search ?? ''}
          placeholder="Search token e.g. A102"
          className="w-44"
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('search', (e.target as HTMLInputElement).value)
          }}
        />
        <select
          value={filters.departmentId ?? ''}
          onChange={(e) => setParam('departmentId', e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.nameEn}</option>
          ))}
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) => setParam('status', e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_PILL).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <Input
          type="date"
          defaultValue={filters.from ?? ''}
          className="w-40"
          onChange={(e) => setParam('from', e.target.value)}
        />
        <Input
          type="date"
          defaultValue={filters.to ?? ''}
          className="w-40"
          onChange={(e) => setParam('to', e.target.value)}
        />
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-muted-foreground">
          No tokens match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5 text-start font-semibold">Token</th>
                <th className="px-4 py-2.5 text-start font-semibold">Department</th>
                <th className="px-4 py-2.5 text-start font-semibold">Date</th>
                <th className="px-4 py-2.5 text-start font-semibold">Issued</th>
                <th className="px-4 py-2.5 text-start font-semibold">Called</th>
                <th className="px-4 py-2.5 text-end font-semibold">Wait</th>
                <th className="px-4 py-2.5 text-start font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const pill = STATUS_PILL[token.status]
                return (
                  <tr key={token.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <span dir="ltr" className="font-mono font-bold tabular-nums text-slate-800">
                        {token.tokenCode}
                      </span>
                      {token.isPriority && (
                        <span className="ms-2 text-[10px] font-bold uppercase text-amber-600">
                          Priority
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {deptById.get(token.departmentId)?.nameEn ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">
                      {formatDate(token.joinedAt)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">
                      {formatTime(token.joinedAt)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">
                      {token.calledAt ? formatTime(token.calledAt) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-slate-600">
                      {waitFor(token)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill.className}`}>
                        {pill.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <PageLink
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            icon={<ChevronLeft className="size-3.5" />}
            label="Previous"
          />
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {lastPage}
          </p>
          <PageLink
            disabled={page >= lastPage}
            onClick={() => setParam('page', String(page + 1))}
            icon={<ChevronRight className="size-3.5" />}
            label="Next"
            trailing
          />
        </div>
      )}
    </div>
  )
}

function PageLink({ disabled, onClick, icon, label, trailing }: {
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  trailing?: boolean
}) {
  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      {!trailing && icon}
      {label}
      {trailing && icon}
    </Button>
  )
}
