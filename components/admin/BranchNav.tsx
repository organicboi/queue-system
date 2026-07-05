import Link from 'next/link'
import { LayoutDashboard, MonitorCheck, Image, Tv, ScrollText, Settings } from 'lucide-react'

type Tab = 'overview' | 'counters' | 'ads' | 'screens' | 'logs' | 'settings'

interface Props {
  branchId: string
  active: Tab
}

const tabs: { id: Tab; label: string; icon: React.ElementType; segment: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard, segment: ''         },
  { id: 'counters',  label: 'Counters',  icon: MonitorCheck,    segment: '/counters' },
  { id: 'ads',       label: 'Ads',       icon: Image,           segment: '/ads'      },
  { id: 'screens',   label: 'Screens',   icon: Tv,              segment: '/screens'  },
  { id: 'logs',      label: 'Logs',      icon: ScrollText,      segment: '/logs'     },
  { id: 'settings',  label: 'Settings',  icon: Settings,        segment: '/settings' },
]

export function BranchNav({ branchId, active }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map(({ id, label, icon: Icon, segment }) => {
        const isActive = id === active
        return (
          <Link
            key={id}
            href={`/branches/${branchId}${segment}`}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent-600 text-white'
                : 'text-slate-500 active:bg-slate-100 active:text-slate-800',
            ].join(' ')}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
