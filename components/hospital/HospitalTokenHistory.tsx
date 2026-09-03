'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadHospitalTokensCsv } from '@/lib/hospital/exportCsv'
import { HOSPITAL_TOKEN_PAGE_SIZE } from '@/lib/hospital/constants'
import { pickLocale } from '@/lib/region'
import type { HospitalDepartmentDTO, HospitalTokenDTO, HospitalTokenStatus } from '@/lib/db/hospital-types'

const STATUS_PILL: Record<HospitalTokenStatus, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  held: { label: 'On hold', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  called: { label: 'Called', className: 'bg-accent-50 text-accent-700 border-accent-200' },
  serving: { label: 'Serving', className: 'bg-accent-50 text-accent-700 border-accent-200' },
  served: { label: 'Served', className: 'bg-accent-50 text-accent-700 border-accent-200' },
  'no-show': { label: 'No-show', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

interface Props {
  departments: HospitalDepartmentDTO[]
  tokens: HospitalTokenDTO[]
  total: number
  page: number
  filters: { status?: string; departmentId?: string; search?: string; from?: string; to?: string }
}

export function HospitalTokenHistory({ departments, tokens, total, page, filters }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])
  const lastPage = Math.max(1, Math.ceil(total / HOSPITAL_TOKEN_PAGE_SIZE))

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    router.push(`/hospital/tokens?${next.toString()}`)
  }

  function wait(t: HospitalTokenDTO) {
    if (!t.calledAt) return '—'
    const m = Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
    return m >= 0 ? `${m}m` : '—'
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Token History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} token{total === 1 ? '' : 's'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadHospitalTokensCsv(tokens, deptById, `hospital-tokens-page-${page}.csv`)}
          disabled={tokens.length === 0}
        >
          <Download className="size-3.5" /> Export this page
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Input type="date" defaultValue={filters.from ?? ''} onChange={(e) => setParam('from', e.target.value)} className="h-9 w-auto" />
        <Input type="date" defaultValue={filters.to ?? ''} onChange={(e) => setParam('to', e.target.value)} className="h-9 w-auto" />
        <select
          defaultValue={filters.departmentId ?? ''}
          onChange={(e) => setParam('departmentId', e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{pickLocale(d.name, 'en')}</option>)}
        </select>
        <select
          defaultValue={filters.status ?? 'all'}
          onChange={(e) => setParam('status', e.target.value === 'all' ? '' : e.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
        >
          <option value="all">Any status</option>
          {Object.keys(STATUS_PILL).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Input
          placeholder="Token code"
          defaultValue={filters.search ?? ''}
          onChange={(e) => setParam('search', e.target.value)}
          className="h-9 w-36"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Token</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Issued</th>
              <th className="px-3 py-2 text-right font-medium">Wait</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No tokens match.</td></tr>
            ) : (
              tokens.map((t) => {
                const pill = STATUS_PILL[t.status]
                return (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 tabular-nums text-slate-500">{t.serviceDate}</td>
                    <td className="px-3 py-2 font-mono font-bold tabular-nums" dir="ltr">{t.tokenCode}</td>
                    <td className="px-3 py-2">{pickLocale(deptById.get(t.departmentId)?.name, 'en')}</td>
                    <td className="px-3 py-2 text-slate-500">{t.stage}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill.className}`}>
                        {pill.label}
                      </span>
                      {t.priorityCategory && <span className="ms-1 text-[10px] text-amber-600">{t.priorityCategory}</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">
                      {new Date(t.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{wait(t)}</td>
                    <td className="px-3 py-2 text-slate-500">{t.source}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
          <ChevronLeft className="size-3.5" /> Prev
        </Button>
        <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setParam('page', String(page + 1))}>
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
