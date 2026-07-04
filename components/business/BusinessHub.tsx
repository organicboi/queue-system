'use client'

import Link from 'next/link'
import { ArrowUpRight, PauseCircle } from 'lucide-react'
import { useCounterPresence } from '@/lib/hooks/useCounterPresence'
import { COUNTER_META, COUNTER_TYPE_ORDER } from '@/lib/counterMeta'
import type { BranchDTO, CounterDTO, DashboardStats } from '@/lib/db/types'

interface Props {
  branch: BranchDTO
  businessName: string
  stats: DashboardStats
  isPaused: boolean
  counters: CounterDTO[]
  manageCountersHref: string
  modeHref: string
}

const STAT_TILES: { key: keyof DashboardStats; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'waiting', label: 'Waiting', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { key: 'inProgress', label: 'Serving', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', dot: 'bg-teal-500' },
  { key: 'completed', label: 'Completed', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  { key: 'totalToday', label: 'Total Today', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
]

export function BusinessHub({
  branch, businessName, stats, isPaused, counters, manageCountersHref, modeHref,
}: Props) {
  const presence = useCounterPresence(branch.id)

  return (
    <div className="max-w-4xl mx-auto w-full px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{businessName}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{branch.name}</h1>
        {branch.locationNote && (
          <p className="text-sm text-muted-foreground mt-0.5">{branch.locationNote}</p>
        )}
      </div>

      {isPaused && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 font-medium">
          <PauseCircle className="size-4 shrink-0" />
          This branch&apos;s queue is currently paused
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_TILES.map(({ key, label, color, bg, dot }) => (
          <div key={key} className={`rounded-xl border ${bg} p-3.5 text-center`}>
            <p className={`text-2xl font-black tabular-nums ${color}`}>{stats[key]}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`size-1.5 rounded-full ${dot}`} />
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Business Mode CTA */}
      <a
        href={modeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 hover:bg-teal-100 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-teal-900">Enter Business Mode</p>
          <p className="text-xs text-teal-700 mt-1 max-w-md">
            One all-in-one screen to take orders, call customers, and mark them
            served — handy for small teams that don&apos;t need separate counter
            stations.
          </p>
        </div>
        <ArrowUpRight className="size-5 text-teal-600 shrink-0" />
      </a>

      {/* Counters pipeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Counters</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order → Kitchen (optional) → Billing → Delivery (optional)
            </p>
          </div>
          <Link
            href={manageCountersHref}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 shrink-0"
          >
            Manage Counters →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COUNTER_TYPE_ORDER.map((type) => {
            const meta = COUNTER_META[type]
            const typeCounters = counters.filter((c) => c.type === type)
            const active = typeCounters.filter((c) => c.isActive)
            const online = active.filter((c) => presence.find((p) => p.id === c.id)?.isOnline).length

            return (
              <div key={type} className="rounded-xl border border-gray-200 bg-white p-3.5">
                <div className={`size-8 rounded-lg ${meta.bg} ${meta.color} flex items-center justify-center mb-2`}>
                  {meta.icon}
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {meta.label}
                  {meta.optional && <span className="text-gray-400 font-normal"> · optional</span>}
                </p>
                {active.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-0.5">Not set up</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {active.length} counter{active.length !== 1 ? 's' : ''} · {online} online
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
