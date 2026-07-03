'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { QueueEntryDTO } from '@/lib/db/types'

const TREND_HUE = '#0D9488'

const STATUS_META = [
  { key: 'waiting', label: 'Waiting', color: '#D97706' },
  { key: 'in-progress', label: 'Serving', color: '#0D9488' },
  { key: 'completed', label: 'Completed', color: '#16A34A' },
  { key: 'cancelled', label: 'Cancelled', color: '#DC2626' },
  { key: 'no-show', label: 'No-show', color: '#64748B' },
] as const

function HourlyTrend({ entries }: { entries: QueueEntryDTO[] }) {
  const data = useMemo(() => {
    const buckets: Record<number, number> = {}
    entries.forEach((e) => {
      const h = new Date(e.joinedAt).getHours()
      buckets[h] = (buckets[h] ?? 0) + 1
    })
    return Array.from({ length: 14 }, (_, i) => {
      const h = i + 8 // 8am - 10pm
      return {
        hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`,
        count: buckets[h] ?? 0,
      }
    })
  }, [entries])

  const hasData = data.some((d) => d.count > 0)

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">Customer flow today</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4">Joins per hour, 8am–10pm</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="ownerTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TREND_HUE} stopOpacity={0.12} />
                <stop offset="100%" stopColor={TREND_HUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#EEF1F2" strokeDasharray="0" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={24} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB', boxShadow: 'none' }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
              cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={TREND_HUE}
              strokeWidth={2}
              fill="url(#ownerTrendFill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
          No customers yet today
        </div>
      )}
    </div>
  )
}

function StatusBreakdown({ entries }: { entries: QueueEntryDTO[] }) {
  const segments = useMemo(() => {
    const counts: Record<string, number> = {}
    entries.forEach((e) => {
      counts[e.status] = (counts[e.status] ?? 0) + 1
    })
    return STATUS_META
      .map((s) => ({ ...s, value: counts[s.key] ?? 0 }))
      .filter((s) => s.value > 0)
  }, [entries])

  const total = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">Status breakdown</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-5">{total} customer{total !== 1 ? 's' : ''} today</p>

      {total > 0 ? (
        <>
          <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100">
            {segments.map((s, i) => (
              <div
                key={s.key}
                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
                className={i === 0 ? 'rounded-l-full' : i === segments.length - 1 ? 'rounded-r-full' : ''}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                <span className="text-xs font-semibold text-gray-800 ml-auto tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
          No activity yet
        </div>
      )}
    </div>
  )
}

export function OwnerAnalytics({ entries }: { entries: QueueEntryDTO[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <HourlyTrend entries={entries} />
      <StatusBreakdown entries={entries} />
    </div>
  )
}
