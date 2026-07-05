'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { logoutAction } from '@/lib/actions/auth'
import {
  LayoutDashboard, GitBranch, Users, BarChart2, Settings, LogOut, ListOrdered, Eye, Image, MonitorCheck, ChevronDown,
} from 'lucide-react'
import type { BranchDTO } from '@/lib/db/types'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/branches',   label: 'Branches',    icon: GitBranch },
  { href: '/ads',        label: 'Common Ads',  icon: Image },
  { href: '/users',      label: 'Users',       icon: Users },
  { href: '/analytics',  label: 'Analytics',   icon: BarChart2 },
  { href: '/settings',   label: 'Settings',    icon: Settings },
]

interface SidebarProps {
  onNavigate?: () => void
  branches?: BranchDTO[]
}

export function Sidebar({ onNavigate, branches = [] }: SidebarProps) {
  const pathname = usePathname()

  const branchMatch = pathname.match(/^\/branches\/([^/]+)\/counters/)
  const [countersOpen, setCountersOpen] = useState(!!branchMatch)
  // const businessModeHref = branchMatch ? `/business/${branchMatch[1]}` : '/business'

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-slate-200 px-5 gap-3">
        <div className="size-8 rounded-lg bg-accent-600 flex items-center justify-center shrink-0">
          <ListOrdered className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">Queue System</p>
          <p className="text-[11px] text-slate-400">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
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
                  ? 'bg-accent-600 text-white'
                  : 'text-slate-600 active:bg-slate-100 active:text-slate-800'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {branches.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setCountersOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 active:bg-slate-100 active:text-slate-800 transition-colors"
            >
              <MonitorCheck className="size-4 shrink-0" />
              <span className="flex-1 text-start">Counters</span>
              <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', countersOpen && 'rotate-180')} />
            </button>
            {countersOpen && (
              <div className="mt-0.5 ms-4 space-y-0.5 border-s border-slate-200 ps-3">
                {branches.map((branch) => {
                  const href = `/branches/${branch.id}/counters`
                  const isActive = pathname === href
                  return (
                    <Link
                      key={branch.id}
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        'block truncate px-2 py-1.5 text-sm rounded-md transition-colors',
                        isActive
                          ? 'bg-accent-600 text-white'
                          : 'text-slate-500 active:bg-slate-100 active:text-slate-800'
                      )}
                    >
                      {branch.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <Separator className="my-4 bg-slate-200" />
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-slate-200 p-3 space-y-1">
        {/* Business Mode — disabled for now
        <Link
          href={businessModeHref}
          target="_blank"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 active:bg-slate-100 active:text-slate-800 transition-colors"
        >
          <MonitorSmartphone className="size-4 shrink-0" />
          Business
        </Link>
        */}
        <Link
          href="/owner"
          target="_blank"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 active:bg-slate-100 active:text-slate-800 transition-colors"
        >
          <Eye className="size-4 shrink-0" />
          Owner Mode
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 active:text-red-600 active:bg-red-50 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
