'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { logoutAction } from '@/lib/actions/auth'
import {
  LayoutDashboard, Building2, MonitorCheck, Tv, ListOrdered,
  BarChart2, Settings, Users, LogOut, GraduationCap, Megaphone,
} from 'lucide-react'

const navItems = [
  { href: '/school/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/school/departments', label: 'Departments', icon: Building2 },
  { href: '/school/counters',    label: 'Counters',    icon: MonitorCheck },
  { href: '/school/screens',     label: 'TV Screens',  icon: Tv },
  { href: '/school/ads',         label: 'Ads & Media', icon: Megaphone },
  { href: '/school/tokens',      label: 'Token History', icon: ListOrdered },
  { href: '/school/reports',     label: 'Reports',     icon: BarChart2 },
  { href: '/school/users',       label: 'Users',       icon: Users },
  { href: '/school/settings',    label: 'Settings',    icon: Settings },
]

export function SchoolSidebar({ onNavigate, schoolName }: {
  onNavigate?: () => void
  schoolName?: string
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-5 gap-3">
        <div className="size-8 rounded-lg bg-accent-600 flex items-center justify-center shrink-0">
          <GraduationCap className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{schoolName ?? 'School Queue'}</p>
          <p className="text-[11px] text-slate-400">Manager</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-accent-600 text-white'
                  : 'text-slate-600 active:bg-slate-100 active:text-slate-800'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
        <Separator className="my-4 bg-slate-200" />
      </nav>

      <div className="border-t border-slate-200 p-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 active:text-red-600 active:bg-red-50 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
