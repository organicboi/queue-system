import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/db/server'
import { PublicJoinForm } from '@/components/public/PublicJoinForm'
import { ListOrdered } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ branchId: string }>
}

export default async function JoinPage({ params }: Props) {
  const { branchId } = await params

  const supabase = await createSupabaseServerClient()
  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, allow_self_join, queue_label, customer_id')
    .eq('id', branchId)
    .eq('is_active', true)
    .single()

  if (!branch) notFound()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-teal-50 mb-3">
            <ListOrdered className="size-6 text-teal-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{branch.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Join the queue</p>
        </div>

        <PublicJoinForm
          branchId={branch.id}
          branchName={branch.name}
          queueLabel={branch.queue_label ?? 'Queue Number'}
          allowSelfJoin={branch.allow_self_join ?? true}
        />
      </div>
    </div>
  )
}
