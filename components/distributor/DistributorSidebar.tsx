'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { distributorLogoutAction } from '@/lib/actions/auth'
import { LayoutDashboard, Users, Key, LogOut, Shield } from 'lucide-react'

const navItems = [
  { href: '/distributor',           label: 'Overview',   icon: LayoutDashboard },
  { href: '/distributor/customers', label: 'Customers',  icon: Users },
  { href: '/distributor/keys',      label: 'License Keys', icon: Key },
]

export function DistributorSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5 gap-3">
        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Shield className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground">Distributor</p>
          <p className="text-[11px] text-muted-foreground">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/distributor' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
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

      <div className="border-t border-sidebar-border p-3">
        <form action={distributorLogoutAction}>
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
