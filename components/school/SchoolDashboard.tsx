'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ticket, Clock, CheckCircle2, Timer, ArrowRight } from 'lucide-react'
import { formatDuration, formatRelativeTime } from '@/lib/queueUtils'
import type {
  SchoolDashboardStats, SchoolCounterDTO, SchoolDepartmentDTO,
  SchoolTokenDTO, SchoolActivityLogDTO,
} from '@/lib/db/school-types'

interface Props {
  branchName: string
  serviceDate: string
  stats: SchoolDashboardStats
  counters: SchoolCounterDTO[]
  departments: SchoolDepartmentDTO[]
  tokens: SchoolTokenDTO[]
  activity: SchoolActivityLogDTO[]
  needsSetup: boolean
}

const REFRESH_MS = 15000

export function SchoolDashboard({
  branchName, serviceDate, stats, counters, departments, tokens, activity, needsSetup,
}: Props) {
  const router = useRouter()

  // "Real-time monitoring of all departments" — the page is server-rendered,
  // so a refresh is the whole mechanism. Pausing while hidden keeps a
  // dashboard left open on a spare monitor from polling all night.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  const calledByCounter = new Map(
    tokens.filter((t) => t.status === 'called' && t.counterId).map((t) => [t.counterId!, t])
  )
  const deptById = new Map(departments.map((d) => [d.id, d]))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Today</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {branchName} · {serviceDate}
        </p>
      </div>

      {needsSetup && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Finish setting up</p>
          <p className="mt-1 text-sm text-amber-800">
            You need at least one department and one counter before the kiosk can issue tokens.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/school/departments"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Departments <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/school/counters"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800"
            >
              Counters <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Ticket} label="Total Tokens" value={stats.totalTokens} tone="slate" />
        <Tile icon={CheckCircle2} label="Served" value={stats.served} tone="accent" />
        <Tile icon={Clock} label="Waiting" value={stats.waiting} tone="amber" />
        <Tile
          icon={Timer}
          label="Average Wait"
          value={stats.avgWaitMinutes > 0 ? formatDuration(stats.avgWaitMinutes) : '—'}
          tone="slate"
        />
      </div>

      {/* Live counters */}
      <section className="space-y-2">
        <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Counters
        </h2>
        {counters.length === 0 ? (
          <EmptyCard>No counters yet</EmptyCard>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {counters.filter((c) => c.isActive).map((counter) => {
              const token = calledByCounter.get(counter.id)
              return (
                <li
                  key={counter.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <span
                    dir="ltr"
                    className={
                      token
                        ? 'flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-600 font-mono text-sm font-black tabular-nums text-white'
                        : 'flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-sm font-black text-slate-400'
                    }
                  >
                    {token?.tokenCode ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{counter.nameEn}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {token
                        ? deptById.get(token.departmentId)?.nameEn ?? 'Serving'
                        : counter.isOpen ? 'Open · available' : 'Closed'}
                    </p>
                  </div>
                  {counter.lastSeenAt && (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatRelativeTime(counter.lastSeenAt)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Department-wise */}
      <section className="space-y-2">
        <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          By department
        </h2>
        {stats.byDepartment.length === 0 ? (
          <EmptyCard>No departments yet</EmptyCard>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-start font-semibold">Department</th>
                  <th className="px-4 py-2.5 text-end font-semibold">Tokens</th>
                  <th className="px-4 py-2.5 text-end font-semibold">Served</th>
                  <th className="px-4 py-2.5 text-end font-semibold">Waiting</th>
                  <th className="px-4 py-2.5 text-end font-semibold">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDepartment.map((d) => (
                  <tr key={d.departmentId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="truncate font-medium text-slate-800">{d.nameEn}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-slate-700">{d.total}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-accent-700">{d.served}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-amber-700">{d.waiting}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-slate-600">
                      {d.avgWaitMinutes > 0 ? formatDuration(d.avgWaitMinutes) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="space-y-2">
        <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <EmptyCard>Nothing has happened yet today</EmptyCard>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {activity.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{log.message}</span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Metric tone follows the same 3-hue budget as the status pills: amber only
// for waiting, accent for done, slate for everything neutral.
const TONES = {
  slate:  { value: 'text-slate-800',  icon: 'text-slate-400' },
  accent: { value: 'text-accent-700', icon: 'text-accent-600' },
  amber:  { value: 'text-amber-700',  icon: 'text-amber-600' },
} as const

function Tile({ icon: Icon, label, value, tone }: {
  icon: typeof Ticket
  label: string
  value: string | number
  tone: keyof typeof TONES
}) {
  const t = TONES[tone]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${t.icon}`} />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={`mt-1.5 text-3xl font-black tabular-nums ${t.value}`}>{value}</p>
    </div>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
