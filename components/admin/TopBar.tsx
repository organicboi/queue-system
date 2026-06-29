'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'

function getTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/branches') return 'Branches'
  if (pathname.startsWith('/branches/') && pathname.endsWith('/settings')) return 'Branch Settings'
  if (pathname.startsWith('/branches/') && pathname.endsWith('/screens')) return 'Screen Management'
  if (pathname.startsWith('/branches/') && pathname.endsWith('/ads')) return 'Ads & Ticker'
  if (pathname.startsWith('/branches/')) return 'Queue Management'
  if (pathname === '/users') return 'Users'
  if (pathname === '/analytics') return 'Analytics'
  if (pathname === '/settings') return 'Settings'
  return 'Queue System'
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const title = getTitle(pathname)
  const [open, setOpen] = useState(false)
  const { canInstall, install } = usePWAInstall()

  const isOnBranch = pathname.startsWith('/branches/') && !pathname.endsWith('/settings') &&
    !pathname.endsWith('/screens') && !pathname.endsWith('/ads') && pathname !== '/branches'

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-white px-4 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden shrink-0">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0 border-border bg-sidebar">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      {canInstall && (
        <Button onClick={install} size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10 shrink-0">
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </Button>
      )}

      {pathname === '/branches' && (
        <Button
          onClick={() => router.push('/branches')}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shrink-0"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">New Branch</span>
        </Button>
      )}
    </header>
  )
}
