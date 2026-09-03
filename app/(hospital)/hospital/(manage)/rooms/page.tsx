import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalRooms, getHospitalDepartments, getHospitalDoctors } from '@/lib/dal/hospital'
import { getHospitalRoomQuota } from '@/lib/dal/hospital-limits'
import { HospitalRoomsManager } from '@/components/hospital/HospitalRoomsManager'

export const dynamic = 'force-dynamic'

export default async function HospitalRoomsPage() {
  const { branch, profile } = await requireHospitalContext()
  const [rooms, departments, doctors, quota] = await Promise.all([
    getHospitalRooms(branch.id),
    getHospitalDepartments(branch.id, { activeOnly: true }),
    getHospitalDoctors(branch.id, { activeOnly: true }),
    getHospitalRoomQuota(profile.customerId, branch.id),
  ])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rooms</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Consult rooms and service bays. Each room console logs in with its own link. For an OPD
          room, set which doctor is sitting there this session.
        </p>
      </div>
      <HospitalRoomsManager
        branchId={branch.id}
        initialRooms={rooms}
        departments={departments}
        doctors={doctors}
        quota={quota}
      />
    </div>
  )
}
