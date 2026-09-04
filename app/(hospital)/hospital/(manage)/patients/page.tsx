import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalDepartments, getHospitalDoctors, getHospitalServiceDate } from '@/lib/dal/hospital'
import { HospitalReception } from '@/components/hospital/HospitalReception'

export const dynamic = 'force-dynamic'

export default async function HospitalPatientsPage() {
  const { branch } = await requireHospitalContext()
  const [departments, doctors, serviceDate] = await Promise.all([
    getHospitalDepartments(branch.id, { activeOnly: true }),
    getHospitalDoctors(branch.id, { activeOnly: true, withSchedules: true }),
    getHospitalServiceDate(branch.id),
  ])

  const weekday = new Date(`${serviceDate}T00:00:00`).getDay()
  const onDuty = new Set(
    doctors
      .filter((d) =>
        (d.schedules ?? []).some((s) => s.weekday === weekday) &&
        !(d.leaves ?? []).some((l) => l.leaveDate === serviceDate))
      .map((d) => d.id)
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reception</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Register a patient, open a visit, and hand a token to anyone who can’t use the kiosk.
          Patient details are consent-captured and access-logged (DPDP Act 2023).
        </p>
      </div>
      <HospitalReception
        branchId={branch.id}
        serviceDate={serviceDate}
        departments={departments
          .filter((d) => d.type === 'opd' || d.type === 'triage')
          .map((d) => ({ id: d.id, name: d.name.en, type: d.type }))}
        doctors={doctors.map((d) => ({
          id: d.id, name: d.name, departmentId: d.departmentId,
          feePaise: d.feePaise, onDuty: onDuty.has(d.id),
          // Carried through so the appointment form can flag (not block) a
          // future date outside the doctor's usual weekly pattern, and hard-
          // block one they're explicitly marked on leave for — the same
          // leave check book_hospital_appointment runs server-side.
          weekdays: Array.from(new Set((d.schedules ?? []).map((s) => s.weekday))),
          leaveDates: (d.leaves ?? []).map((l) => l.leaveDate),
        }))}
      />
    </div>
  )
}
