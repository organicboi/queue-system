'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/actions/auth'
import {
  LayoutDashboard, MonitorCheck, Image, Tv, ScrollText, LogOut, ListOrdered, ChevronDown, ExternalLink,
} from 'lucide-react'
import type { CounterDTO } from '@/lib/db/types'

const navItems = [
  { href: '/branch',          label: 'Overview', icon: LayoutDashboard },
  { href: '/branch/ads',      label: 'Ads',       icon: Image },
  { href: '/branch/screens',  label: 'Screens',   icon: Tv },
  { href: '/branch/logs',     label: 'Logs',      icon: ScrollText },
]

interface BranchSidebarProps {
  branchName: string
  counters?: CounterDTO[]
  onNavigate?: () => void
}

export function BranchSidebar({ branchName, counters = [], onNavigate }: BranchSidebarProps) {
  const pathname = usePathname()
  const [countersOpen, setCountersOpen] = useState(pathname.startsWith('/branch/counters'))

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-5 gap-3">
        <div className="size-8 rounded-lg bg-accent-600 flex items-center justify-center shrink-0">
          <ListOrdered className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{branchName}</p>
          <p className="text-[11px] text-slate-400">Branch Panel</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Menu
        </p>
        <Link
          href="/branch"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            pathname === '/branch'
              ? 'bg-accent-600 text-white'
              : 'text-slate-600 active:bg-slate-100 active:text-slate-800'
          )}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          Overview
        </Link>

        <div>
          <div className="flex items-center rounded-lg active:bg-slate-100 transition-colors">
            <Link
              href="/branch/counters"
              onClick={onNavigate}
              className={cn(
                'flex flex-1 items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                pathname === '/branch/counters'
                  ? 'bg-accent-600 text-white'
                  : 'text-slate-600 active:text-slate-800'
              )}
            >
              <MonitorCheck className="size-4 shrink-0" />
              Counters
            </Link>
            {counters.length > 0 && (
              <button
                type="button"
                onClick={() => setCountersOpen((v) => !v)}
                className="px-2.5 py-2 text-slate-600 active:text-slate-800"
                aria-label={countersOpen ? 'Collapse counters' : 'Expand counters'}
              >
                <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', countersOpen && 'rotate-180')} />
              </button>
            )}
          </div>
          {countersOpen && counters.length > 0 && (
            <div className="mt-0.5 ms-4 space-y-0.5 border-s border-slate-200 ps-3">
              {counters.map((counter) => (
                <a
                  key={counter.id}
                  href={`/counter/${counter.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center justify-between gap-2 truncate px-2 py-1.5 text-sm rounded-md transition-colors',
                    counter.isActive
                      ? 'text-slate-500 active:bg-slate-100 active:text-slate-800'
                      : 'text-slate-300 pointer-events-none'
                  )}
                  title={counter.isActive ? `Open ${counter.name}` : `${counter.name} (inactive)`}
                >
                  <span className="truncate">{counter.name}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>

        {navItems.slice(1).map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href)
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
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-1">
        {/* Business Mode — disabled for now
        <Link
          href="/business"
          target="_blank"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 active:bg-slate-100 active:text-slate-800 transition-colors"
        >
          <MonitorSmartphone className="size-4 shrink-0" />
          Business
        </Link>
        */}
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
