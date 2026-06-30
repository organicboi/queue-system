'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { logoutAction } from '@/lib/actions/auth'
import {
  LayoutDashboard, GitBranch, Users, BarChart2, Settings, LogOut, ListOrdered, MonitorSmartphone,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { href: '/branches',   label: 'Branches',  icon: GitBranch },
  { href: '/users',      label: 'Users',     icon: Users },
  { href: '/analytics',  label: 'Analytics', icon: BarChart2 },
  { href: '/settings',   label: 'Settings',  icon: Settings },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()

  const branchMatch = pathname.match(/^\/branches\/([^/]+)/)
  const businessModeHref = branchMatch ? `/serve/${branchMatch[1]}` : '/branches'

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-5 gap-3">
        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <ListOrdered className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground truncate">Queue System</p>
          <p className="text-[11px] text-muted-foreground">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
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

        <Separator className="my-4 bg-sidebar-border" />
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <Link
          href={businessModeHref}
          target="_blank"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <MonitorSmartphone className="size-4 shrink-0" />
          Business Mode
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
