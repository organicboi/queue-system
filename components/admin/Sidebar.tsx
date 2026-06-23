"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useSettingsStore } from "@/store/settingsStore"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const businessName = useSettingsStore((s) => s.businessName)

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground truncate">{businessName}</p>
          <p className="text-[11px] text-muted-foreground">Restaurant Queue</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-5 space-y-0.5">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {label}
            </Link>
          )
        })}

        <Separator className="my-4 bg-sidebar-border" />

        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Display
        </p>
        <Link
          href="/display"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          Display Screen
          <span className="text-[10px] text-muted-foreground">↗</span>
        </Link>
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-1">
        <Link
          href="/business"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          Business Mode
          <span className="text-[10px] text-muted-foreground">↗</span>
        </Link>
      </div>
    </div>
  )
}
