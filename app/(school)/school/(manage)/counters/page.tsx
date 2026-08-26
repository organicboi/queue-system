import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolCounters, getSchoolDepartments } from '@/lib/dal/school'
import { SchoolCountersManager } from '@/components/school/SchoolCountersManager'

export const dynamic = 'force-dynamic'

export default async function SchoolCountersPage() {
  const { branch } = await requireSchoolContext()
  const [counters, departments] = await Promise.all([
    getSchoolCounters(branch.id),
    getSchoolDepartments(branch.id, { activeOnly: true }),
  ])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Counters</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Each counter gets its own link. Open it on the operator&apos;s PC — that page is the
          calling keypad.
        </p>
      </div>
      <SchoolCountersManager
        branchId={branch.id}
        initialCounters={counters}
        departments={departments}
      />
    </div>
  )
}
