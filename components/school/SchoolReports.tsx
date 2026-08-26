'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/queueUtils'
import { downloadTokensCsv } from '@/lib/school/exportCsv'
import type { SchoolDepartmentDTO, SchoolTokenDTO } from '@/lib/db/school-types'

const RANGES = [
  { key: '1d', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
]

interface Props {
  range: string
  departments: SchoolDepartmentDTO[]
  tokens: SchoolTokenDTO[]
  total: number
}

export function SchoolReports({ range, departments, tokens, total }: Props) {
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])

  const byDepartment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tokens) counts.set(t.departmentId, (counts.get(t.departmentId) ?? 0) + 1)
    return departments
      .map((d) => ({ name: d.nameEn, value: counts.get(d.id) ?? 0, color: d.color }))
      .filter((d) => d.value > 0)
  }, [tokens, departments])

  // Wait is called_at − joined_at: what the visitor actually experienced.
  const waitByDepartment = useMemo(() => {
    const sums = new Map<string, { total: number; n: number }>()
    for (const t of tokens) {
      if (!t.calledAt) continue
      const mins = Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
      if (mins < 0) continue
      const acc = sums.get(t.departmentId) ?? { total: 0, n: 0 }
      acc.total += mins
      acc.n += 1
      sums.set(t.departmentId, acc)
    }
    return departments
      .map((d) => {
        const acc = sums.get(d.id)
        return {
          name: d.prefix,
          fullName: d.nameEn,
          minutes: acc && acc.n ? Math.round(acc.total / acc.n) : 0,
          color: d.color,
        }
      })
      .filter((d) => d.minutes > 0)
  }, [tokens, departments])

  const served = tokens.filter((t) => t.status === 'served').length
  const noShow = tokens.filter((t) => t.status === 'no-show').length
  const waits = tokens
    .filter((t) => t.calledAt)
    .map((t) => Math.round((new Date(t.calledAt!).getTime() - new Date(t.joinedAt).getTime()) / 60000))
    .filter((m) => m >= 0)
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} token{total !== 1 ? 's' : ''} in this period
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadTokensCsv(tokens, deptById, `school-tokens-${range}.csv`)}
          disabled={tokens.length === 0}
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/school/reports?range=${r.key}`}
            className={
              r.key === range
                ? 'rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white'
                : 'rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-50'
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Total" value={total} className="text-slate-800" />
        <Summary label="Served" value={served} className="text-accent-700" />
        <Summary label="No-shows" value={noShow} className="text-slate-600" />
        <Summary
          label="Avg wait"
          value={avgWait > 0 ? formatDuration(avgWait) : '—'}
          className="text-slate-800"
        />
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-muted-foreground">
          No tokens were issued in this period.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Average wait by department">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={waitByDepartment}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                <Tooltip
                  formatter={(value) => [formatDuration(Number(value ?? 0)), 'Average wait']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                  {waitByDepartment.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Tokens by department">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byDepartment} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {byDepartment.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={44} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}

function Summary({ label, value, className }: { label: string; value: string | number; className: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-center">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`text-3xl font-black tabular-nums ${className}`}>{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  )
}
