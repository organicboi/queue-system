import { Users, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '@/lib/db/types'

interface Props {
  stats: DashboardStats
  avgServiceTime: number
}

// Design system v5, §2.5 — metric tone follows the same 3-hue budget as
// status pills: a plain count is neutral, waiting is amber, anything in
// the "progressing/done" family shares the one accent bucket.
const cards = (stats: DashboardStats, avgServiceTime: number) => [
  {
    label: 'Total Today',
    value: stats.totalToday,
    icon: Users,
    accent: 'slate',
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
    accent: 'accent',
    sub: 'being served now',
  },
  {
    label: 'Completed',
    value: stats.completed,
    icon: CheckCircle2,
    accent: 'accent',
    sub: stats.avgWaitMinutes > 0 ? `avg ${stats.avgWaitMinutes}m wait` : 'today',
  },
]

const accents: Record<string, string> = {
  slate:  'bg-slate-100 text-slate-600 border-slate-200',
  amber:  'bg-amber-50 text-amber-600 border-amber-100',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
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
            <p className="text-3xl font-mono font-black text-slate-800 tabular-nums leading-none" dir="ltr">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
