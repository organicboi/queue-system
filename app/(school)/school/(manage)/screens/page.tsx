import { requireSchoolContext } from '@/lib/dal/school-context'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { SchoolScreensManager } from '@/components/school/SchoolScreensManager'

export const dynamic = 'force-dynamic'

export default async function SchoolScreensPage() {
  const { branch } = await requireSchoolContext()

  // Screens are the shared table — reusing it is what gives the school board
  // the ads cascade, the plan quota and presence for free. `kind` is what
  // makes one a school board.
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('screens')
    .select('id, name, screen_token, is_active, last_seen_at, kind')
    .eq('branch_id', branch.id)
    .eq('kind', 'school')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Devices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Point each device at its own link once; the link is the login.
        </p>
      </div>
      <SchoolScreensManager
        branchId={branch.id}
        branchToken={branch.branchToken}
        initialScreens={(data ?? []) as { id: string; name: string; screen_token: string; last_seen_at: string | null }[]}
      />
    </div>
  )
}
