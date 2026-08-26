import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolDepartments } from '@/lib/dal/school'
import { SchoolDepartmentsManager } from '@/components/school/SchoolDepartmentsManager'

export const dynamic = 'force-dynamic'

export default async function SchoolDepartmentsPage() {
  const { branch } = await requireSchoolContext()
  const departments = await getSchoolDepartments(branch.id)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Departments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Each department issues its own token series — the prefix plus a number that
          restarts every morning.
        </p>
      </div>
      <SchoolDepartmentsManager branchId={branch.id} initialDepartments={departments} />
    </div>
  )
}
