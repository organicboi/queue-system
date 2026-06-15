"use client"

import { useState } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { TopBar } from "@/components/admin/TopBar"
import { AddCustomerModal } from "@/components/admin/AddCustomerModal"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onAddCustomer={() => setAddOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
