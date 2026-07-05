import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'
import { getBranches, getActiveBranchId } from '@/lib/dal/branches'
import { Sidebar } from '@/components/admin/Sidebar'
import { TopBar } from '@/components/admin/TopBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')
  if (profile.role !== 'admin') redirect('/branch')

  const [branches, activeBranchId] = await Promise.all([
    getBranches(profile.customerId),
    getActiveBranchId(profile.customerId),
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden w-60 shrink-0 border-e border-slate-200 md:flex md:flex-col">
        <Sidebar branches={branches} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar branches={branches} activeBranchId={activeBranchId} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
