'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { BranchSidebar } from './BranchSidebar'
import { useState } from 'react'

function getTitle(pathname: string): string {
  if (pathname === '/branch') return 'Overview'
  if (pathname.startsWith('/branch/counters')) return 'Counters'
  if (pathname.startsWith('/branch/ads')) return 'Ads & Ticker'
  if (pathname.startsWith('/branch/screens')) return 'Screen Management'
  return 'Branch Panel'
}

interface BranchTopBarProps {
  branchName: string
}

export function BranchTopBar({ branchName }: BranchTopBarProps) {
  const pathname = usePathname()
  const title = getTitle(pathname)
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-white px-4 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden shrink-0">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0 border-border bg-sidebar">
          <BranchSidebar branchName={branchName} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
      </div>
    </header>
  )
}
