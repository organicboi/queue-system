import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { getScreens } from '@/lib/dal/screens'
import { ScreensManager } from '@/components/admin/ScreensManager'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchScreensPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const [branch, screens] = await Promise.all([
    getBranch(branchId, profile.customerId),
    getScreens(branchId, profile.customerId),
  ])

  if (!branch) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/branches/${branchId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 mb-2"
        >
          <ChevronLeft className="size-3.5" />
          Back to {branch.name}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Screen Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name} — TV displays</p>
      </div>
      <ScreensManager branchId={branchId} initialScreens={screens} />
    </div>
  )
}
