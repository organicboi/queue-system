import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'
import { getAccessibleBranches } from '@/lib/dal/users'
import { BranchSidebar } from '@/components/branch/BranchSidebar'
import { BranchTopBar } from '@/components/branch/BranchTopBar'

export default async function BranchOperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')
  if (profile.role === 'admin') redirect('/dashboard')

  const branches = await getAccessibleBranches(profile)
  const branch = branches[0]

  if (!branch) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-gray-900">No branch assigned</p>
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to a branch yet. Ask an admin to assign you to one.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <BranchSidebar branchName={branch.name} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <BranchTopBar branchName={branch.name} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
