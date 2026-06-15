"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"
import { useState } from "react"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/queue-management": "Queue Management",
  "/analytics": "Analytics",
  "/customer-links": "Customer Links",
  "/settings": "Settings",
}

interface TopBarProps {
  onAddCustomer: () => void
}

export function TopBar({ onAddCustomer }: TopBarProps) {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? "Dashboard"
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-white px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0 border-border bg-sidebar">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>

      <Button
        onClick={onAddCustomer}
        size="sm"
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Add Customer
      </Button>
    </header>
  )
}
