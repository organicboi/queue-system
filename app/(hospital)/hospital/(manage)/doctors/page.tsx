import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalDoctors, getHospitalDepartments } from '@/lib/dal/hospital'
import { HospitalDoctorsManager } from '@/components/hospital/HospitalDoctorsManager'

export const dynamic = 'force-dynamic'

export default async function HospitalDoctorsPage() {
  const { branch } = await requireHospitalContext()
  const [doctors, departments] = await Promise.all([
    getHospitalDoctors(branch.id, { withSchedules: true }),
    getHospitalDepartments(branch.id, { activeOnly: true }),
  ])

  const opdDepartments = departments.filter((d) => d.type === 'opd')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Doctors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          A doctor with no schedule for the day never appears on the kiosk. Mark leaves ahead of
          time — the kiosk checks schedule minus leave.
        </p>
      </div>
      <HospitalDoctorsManager
        branchId={branch.id}
        initialDoctors={doctors}
        opdDepartments={opdDepartments}
      />
    </div>
  )
}
