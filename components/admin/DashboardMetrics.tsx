import { Users, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '@/lib/db/types'

interface Props {
  stats: DashboardStats
  avgServiceTime: number
}

const cards = (stats: DashboardStats, avgServiceTime: number) => [
  {
    label: 'Total Today',
    value: stats.totalToday,
    icon: Users,
    accent: 'blue',
    sub: 'customers served',
  },
  {
    label: 'Waiting',
    value: stats.waiting,
    icon: Clock,
    accent: 'amber',
    sub: `~${stats.waiting * avgServiceTime} min wait`,
  },
  {
    label: 'In Progress',
    value: stats.inProgress,
    icon: TrendingUp,
    accent: 'indigo',
    sub: 'being served now',
  },
  {
    label: 'Completed',
    value: stats.completed,
    icon: CheckCircle2,
    accent: 'emerald',
    sub: stats.avgWaitMinutes > 0 ? `avg ${stats.avgWaitMinutes}m wait` : 'today',
  },
]

const accents: Record<string, string> = {
  blue:    'bg-blue-50 text-blue-600 border-blue-100',
  amber:   'bg-amber-50 text-amber-600 border-amber-100',
  indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
}

export function DashboardMetrics({ stats, avgServiceTime }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards(stats, avgServiceTime).map(({ label, value, icon: Icon, accent, sub }) => (
        <div key={label} className="rounded-xl border border-border bg-white p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${accents[accent]}`}>
              <Icon className="size-4" />
            </span>
          </div>
          <div>
            <p className="text-3xl font-black text-gray-900 tabular-nums leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
