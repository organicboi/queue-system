import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Store } from 'lucide-react'
import { requireProfile } from '@/lib/dal/session'
import { getAccessibleBranches } from '@/lib/dal/users'

export const dynamic = 'force-dynamic'

export default async function BusinessPage() {
  const profile = await requireProfile()
  const branches = await getAccessibleBranches(profile)

  if (branches.length === 0) {
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

  if (branches.length === 1) {
    redirect(`/business/${branches[0].id}`)
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Business</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick a branch to manage its counters and Business Mode.</p>
      </div>
      <div className="space-y-2">
        {branches.map((branch) => (
          <Link
            key={branch.id}
            href={`/business/${branch.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-teal-300 hover:bg-teal-50/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <Store className="size-4 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{branch.name}</p>
                {branch.locationNote && (
                  <p className="text-xs text-muted-foreground truncate">{branch.locationNote}</p>
                )}
              </div>
            </div>
            <ArrowRight className="size-4 text-gray-400 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
