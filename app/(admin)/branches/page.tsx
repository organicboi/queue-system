import { Suspense } from 'react'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranches } from '@/lib/dal/branches'
import { GitBranch, ChevronRight, Plus, Settings, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateBranchModal } from '@/components/admin/CreateBranchModal'

export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  const profile = await requireProfile()
  const branches = await getBranches(profile.customerId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Branches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</p>
        </div>
        <CreateBranchModal />
      </div>

      {branches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <GitBranch className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No branches yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first branch to start accepting queue entries</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-xl border border-border bg-white overflow-hidden">
              <Link href={`/branches/${branch.id}`} className="block p-5 hover:bg-muted/20 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GitBranch className="size-4 text-primary" />
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                </div>
                <div className="mt-3">
                  <p className="font-semibold text-gray-900 truncate">{branch.name}</p>
                  {branch.locationNote && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{branch.locationNote}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-muted-foreground">{branch.isActive ? 'Active' : 'Inactive'}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">Label: {branch.queueLabel}</span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-0 border-t border-border divide-x divide-border">
                <Link
                  href={`/branches/${branch.id}/settings`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-gray-700 hover:bg-muted/20 transition-colors"
                >
                  <Settings className="size-3.5" />
                  Settings
                </Link>
                <Link
                  href={`/branches/${branch.id}/screens`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-gray-700 hover:bg-muted/20 transition-colors"
                >
                  <Tv className="size-3.5" />
                  Screens
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
