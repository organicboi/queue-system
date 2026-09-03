import { requireHospitalContext } from '@/lib/dal/hospital-context'
import {
  getHospitalDashboardStats, getHospitalDepartments, getHospitalDoctors,
  getHospitalRooms, getHospitalEvents, getHospitalServiceDate,
} from '@/lib/dal/hospital'
import { HospitalDashboard } from '@/components/hospital/HospitalDashboard'

export const dynamic = 'force-dynamic'

export default async function HospitalDashboardPage() {
  const { branch } = await requireHospitalContext()
  const [stats, departments, doctors, rooms, events, serviceDate] = await Promise.all([
    getHospitalDashboardStats(branch.id),
    getHospitalDepartments(branch.id, { activeOnly: true }),
    getHospitalDoctors(branch.id, { activeOnly: true }),
    getHospitalRooms(branch.id),
    getHospitalEvents(branch.id, 25),
    getHospitalServiceDate(branch.id),
  ])

  return (
    <HospitalDashboard
      branchName={branch.name}
      serviceDate={serviceDate}
      stats={stats}
      rooms={rooms.filter((r) => r.isActive)}
      events={events}
      needsSetup={departments.length === 0 || doctors.length === 0 || rooms.length === 0}
    />
  )
}
