import { redirect } from 'next/navigation'
import { getUser, getProfile } from '@/lib/dal/session'
import { verticalHome } from '@/lib/verticals'
import { getAssignedBranch } from '@/lib/dal/users'
import { getCounters } from '@/lib/dal/counters'
import { BranchSidebar } from '@/components/branch/BranchSidebar'
import { BranchTopBar } from '@/components/branch/BranchTopBar'

export default async function BranchOperatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')
  // Checked before the role branch below: a school branch_user belongs in the
  // school product, not on the hotel operator console.
  if (profile.vertical === 'school') redirect(verticalHome(profile.vertical, profile.role))
  if (profile.role === 'admin') redirect('/dashboard')

  const branch = await getAssignedBranch(profile)

  if (!branch) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-slate-800">No branch assigned</p>
          <p className="text-sm text-slate-500">
            Your account isn&apos;t linked to a branch yet. Ask an admin to assign you to one.
          </p>
        </div>
      </div>
    )
  }

  const counters = await getCounters(profile.customerId, branch.id)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden w-60 shrink-0 border-e border-slate-200 md:flex md:flex-col">
        <BranchSidebar branchName={branch.name} counters={counters} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <BranchTopBar branchName={branch.name} counters={counters} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
