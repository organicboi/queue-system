'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { QueueEntryDTO } from '@/lib/db/types'
import type { DashboardStats } from '@/lib/db/types'

interface Props {
  entries: QueueEntryDTO[]
  stats: DashboardStats
}

const STATUS_COLORS: Record<string, string> = {
  waiting:       '#D97706',
  'in-progress': '#0D9488',
  completed:     '#16A34A',
  cancelled:     '#DC2626',
}

export function AnalyticsView({ entries, stats }: Props) {
  const hourlyData = useMemo(() => {
    const buckets: Record<number, number> = {}
    entries.forEach((e) => {
      const h = new Date(e.joinedAt).getHours()
      buckets[h] = (buckets[h] ?? 0) + 1
    })
    return Array.from({ length: 14 }, (_, i) => {
      const h = i + 8 // 8 AM – 10 PM
      return {
        hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`,
        count: buckets[h] ?? 0,
      }
    })
  }, [entries])

  const statusPie = [
    { name: 'Waiting', value: stats.waiting, color: STATUS_COLORS.waiting },
    { name: 'In Progress', value: stats.inProgress, color: STATUS_COLORS['in-progress'] },
    { name: 'Completed', value: stats.completed, color: STATUS_COLORS.completed },
    { name: 'Cancelled', value: stats.cancelled, color: STATUS_COLORS.cancelled },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Today', value: stats.totalToday, color: 'text-gray-900' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-500' },
          { label: 'Avg Wait', value: stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : '—', color: 'text-indigo-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hourly volume */}
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-sm font-semibold mb-4">Hourly Volume</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }}
                cursor={{ fill: '#F9FAFB' }}
              />
              <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-sm font-semibold mb-4">Status Breakdown</h3>
          {statusPie.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={statusPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {statusPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusPie.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-muted-foreground flex-1">{name}</span>
                    <span className="text-xs font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent entries table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Entries</h3>
        </div>
        <div className="divide-y divide-border">
          {entries.slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-4 py-3">
              <span className="font-mono font-black text-sm w-8 text-gray-900">#{e.queueNumber}</span>
              <span className="font-mono text-sm text-muted-foreground flex-1">Bill {e.billNumber}</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: STATUS_COLORS[e.status] + '18',
                  color: STATUS_COLORS[e.status],
                }}
              >
                {e.status}
              </span>
              {e.startedAt && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Wait: {Math.round((new Date(e.startedAt).getTime() - new Date(e.joinedAt).getTime()) / 60000)}m
                </span>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No entries today</div>
          )}
        </div>
      </div>
    </div>
  )
}
