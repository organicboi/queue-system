'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/actions/auth'
import {
  LayoutDashboard, MonitorCheck, Image, Tv, ScrollText, LogOut, ListOrdered, MonitorSmartphone,
} from 'lucide-react'

const navItems = [
  { href: '/branch',          label: 'Overview', icon: LayoutDashboard },
  { href: '/branch/counters', label: 'Counters',  icon: MonitorCheck },
  { href: '/branch/ads',      label: 'Ads',       icon: Image },
  { href: '/branch/screens',  label: 'Screens',   icon: Tv },
  { href: '/branch/logs',     label: 'Logs',      icon: ScrollText },
]

interface BranchSidebarProps {
  branchName: string
  onNavigate?: () => void
}

export function BranchSidebar({ branchName, onNavigate }: BranchSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5 gap-3">
        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <ListOrdered className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground truncate">{branchName}</p>
          <p className="text-[11px] text-muted-foreground">Branch Panel</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/branch' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <Link
          href="/business"
          target="_blank"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <MonitorSmartphone className="size-4 shrink-0" />
          Business
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
