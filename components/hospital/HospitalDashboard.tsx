'use client'

import Link from 'next/link'
import { Clock, Users, DoorOpen, CheckCircle2, TimerReset, ArrowRight } from 'lucide-react'
import { formatRelativeTime } from '@/lib/queueUtils'
import { pickLocale } from '@/lib/region'
import type {
  HospitalDashboardStats, HospitalRoomDTO, HospitalTokenEventDTO,
} from '@/lib/db/hospital-types'

interface Props {
  branchName: string
  serviceDate: string
  stats: HospitalDashboardStats
  rooms: HospitalRoomDTO[]
  events: HospitalTokenEventDTO[]
  needsSetup: boolean
}

export function HospitalDashboard({ branchName, serviceDate, stats, rooms, events, needsSetup }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{branchName} · {serviceDate}</p>
        </div>
      </div>

      {needsSetup && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Finish setting up</p>
          <p className="mt-1 text-sm text-amber-800">
            The kiosk and board need at least one OPD department, one doctor with a schedule, and one
            room before they can run.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-medium">
            <Link href="/hospital/departments" className="text-accent-700 hover:underline">Departments →</Link>
            <Link href="/hospital/doctors" className="text-accent-700 hover:underline">Doctors →</Link>
            <Link href="/hospital/rooms" className="text-accent-700 hover:underline">Rooms →</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile icon={Users} label="Waiting" value={stats.waiting} />
        <Tile icon={DoorOpen} label="In a room" value={stats.called} />
        <Tile icon={CheckCircle2} label="Served" value={stats.served} />
        <Tile icon={TimerReset} label="No-shows" value={stats.noShow} />
        <Tile icon={Clock} label="Avg wait" value={`${stats.avgWaitMinutes}m`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Rooms</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active rooms.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className={r.isOpen ? 'size-2 rounded-full bg-emerald-500' : 'size-2 rounded-full bg-slate-300'} />
                <span className="text-sm font-medium text-slate-800">{r.label}</span>
                <span className="ms-auto text-[11px] text-muted-foreground">
                  {r.lastSeenAt ? formatRelativeTime(r.lastSeenAt) : 'never opened'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">By department</h2>
        {stats.byDepartment.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing issued today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-1.5 font-medium">Department</th>
                  <th className="pb-1.5 text-right font-medium">Total</th>
                  <th className="pb-1.5 text-right font-medium">Waiting</th>
                  <th className="pb-1.5 text-right font-medium">Served</th>
                  <th className="pb-1.5 text-right font-medium">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDepartment.map((d) => (
                  <tr key={d.departmentId} className="border-t border-slate-100">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        {pickLocale(d.name, 'en')}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{d.total}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.waiting}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.served}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.avgWaitMinutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent activity</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet today.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <ArrowRight className="size-3.5 shrink-0 text-slate-300" />
                <span className="min-w-0 truncate text-slate-700">{e.message}</span>
                <span className="ms-auto shrink-0 text-[11px] text-muted-foreground">
                  {formatRelativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ icon: Icon, label, value }: {
  icon: typeof Clock
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
