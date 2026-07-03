import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'
import { Sidebar } from '@/components/admin/Sidebar'
import { TopBar } from '@/components/admin/TopBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')
  if (profile.role !== 'admin') redirect('/branch')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
