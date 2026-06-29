import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/dal/session'
import { getBranch } from '@/lib/dal/branches'
import { BranchSettingsForm } from '@/components/admin/BranchSettingsForm'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function BranchSettingsPage({ params }: Props) {
  const { branchId } = await params
  const profile = await requireProfile()
  const branch = await getBranch(branchId, profile.customerId)

  if (!branch) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/branches/${branchId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 mb-2"
        >
          <ChevronLeft className="size-3.5" />
          Back to {branch.name}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Branch Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>
      <BranchSettingsForm branch={branch} />
    </div>
  )
}
