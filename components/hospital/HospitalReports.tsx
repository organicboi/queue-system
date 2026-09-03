'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { Input } from '@/components/ui/input'
import type { HospitalReport } from '@/lib/dal/hospital'

const ACCENT = '#0d9488'
const SLATE = '#94a3b8'

export function HospitalReports({ report }: { report: HospitalReport }) {
  const router = useRouter()
  const params = useSearchParams()

  function setRange(key: 'from' | 'to', value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/hospital/reports?${next.toString()}`)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{report.from} → {report.to}</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" defaultValue={report.from} onChange={(e) => setRange('from', e.target.value)} className="h-9 w-auto" />
          <Input type="date" defaultValue={report.to} onChange={(e) => setRange('to', e.target.value)} className="h-9 w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Tokens" value={report.totalTokens} />
        <Stat label="Served" value={report.served} />
        <Stat label="No-shows" value={report.noShow} />
        <Stat label="No-show rate" value={`${report.noShowRate}%`} />
        <Stat label="Avg wait" value={`${report.avgWaitMinutes}m`} />
      </div>

      <Card title="Volume by day">
        {report.byDay.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={report.byDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="issued" stroke={SLATE} strokeWidth={2} dot={false} name="Issued" />
              <Line type="monotone" dataKey="served" stroke={ACCENT} strokeWidth={2} dot={false} name="Served" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="By department">
        {report.byDepartment.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(200, report.byDepartment.length * 44)}>
            <BarChart data={report.byDepartment} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill={SLATE} name="Total" radius={[0, 4, 4, 0]} />
              <Bar dataKey="served" fill={ACCENT} name="Served" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Journey funnel (tokens reaching each stage)">
        {report.stageFunnel.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(180, report.stageFunnel.length * 40)}>
            <BarChart data={report.stageFunnel} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="reached" fill={ACCENT} radius={[0, 4, 4, 0]} name="Tokens" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Busiest hours">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={report.byHour.filter((h) => h.count > 0)}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(h) => `${h}:00`} />
            <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} name="Tokens" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Doctor productivity">
        {report.byDoctor.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-1.5 font-medium">Doctor</th>
                  <th className="pb-1.5 text-right font-medium">Served</th>
                  <th className="pb-1.5 text-right font-medium">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {report.byDoctor.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.served}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.avgWaitMinutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
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

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No data in this range.</p>
}
