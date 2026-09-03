import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalDepartments } from '@/lib/dal/hospital'
import { getHospitalDepartmentQuota } from '@/lib/dal/hospital-limits'
import { HospitalDepartmentsManager } from '@/components/hospital/HospitalDepartmentsManager'

export const dynamic = 'force-dynamic'

export default async function HospitalDepartmentsPage() {
  const { branch, profile } = await requireHospitalContext()
  const [departments, quota] = await Promise.all([
    getHospitalDepartments(branch.id),
    getHospitalDepartmentQuota(profile.customerId, branch.id),
  ])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Departments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          OPD specialities and service points (lab, radiology, pharmacy, billing, registration).
          Each issues its own token series — a prefix plus a number that restarts every morning.
        </p>
      </div>
      <HospitalDepartmentsManager
        branchId={branch.id}
        initialDepartments={departments}
        quota={quota}
      />
    </div>
  )
}
