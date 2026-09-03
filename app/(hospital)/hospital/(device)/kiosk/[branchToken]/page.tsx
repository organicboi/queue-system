import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import {
  getHospitalKioskPacket, getHospitalKioskFeed, getHospitalDoctors, getHospitalServiceDate,
} from '@/lib/dal/hospital'
import { HospitalKiosk } from '@/components/hospital/HospitalKiosk'

export const dynamic = 'force-dynamic'

// Unattended touch terminal: lock zoom so a fast double-tap on a department
// never leaves the next patient looking at a zoomed-in kiosk.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ branchToken: string }>
}

export default async function HospitalKioskPage({ params }: Props) {
  const { branchToken } = await params
  const packet = await getHospitalKioskPacket(branchToken)
  if (packet.status !== 'ok' || !packet.branchId) notFound()

  const [feed, doctors, serviceDate] = await Promise.all([
    getHospitalKioskFeed(branchToken),
    getHospitalDoctors(packet.branchId, { activeOnly: true, withSchedules: true }),
    getHospitalServiceDate(packet.branchId),
  ])

  // "Today" is a SQL fact; the weekday it falls on is safe to derive from it.
  const weekday = new Date(`${serviceDate}T00:00:00`).getDay()
  const onDutyDoctors = doctors.filter((d) => {
    const scheduledToday = (d.schedules ?? []).some((s) => s.weekday === weekday)
    const onLeave = (d.leaves ?? []).some((l) => l.leaveDate === serviceDate)
    return scheduledToday && !onLeave
  })

  // The kiosk shows OPD specialities and the registration/triage desk.
  const kioskDepartments = (packet.departments ?? []).filter(
    (d) => d.type === 'opd' || d.type === 'triage'
  )

  if (kioskDepartments.length === 0) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-slate-100 p-8 text-center">
        <div>
          <p className="text-2xl font-bold text-slate-800">This kiosk isn&apos;t set up yet</p>
          <p className="mt-2 text-slate-500">
            Add an OPD department (and its doctors) in the hospital manager, then reload this screen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <HospitalKiosk
      branchToken={branchToken}
      hospitalName={
        packet.settings?.hospitalName?.en || packet.branchName || 'Hospital'
      }
      departments={kioskDepartments}
      doctors={onDutyDoctors.map((d) => ({
        id: d.id,
        name: d.name,
        departmentId: d.departmentId,
        specialization: d.specialization,
        feePaise: d.feePaise,
      }))}
      settings={packet.settings ?? null}
      silentPrintEnabled={packet.silentPrint ?? false}
      printerName={packet.printerName ?? ''}
      initialFeed={feed}
      publicTrackingEnabled={packet.publicTrackingEnabled ?? false}
      serviceDate={serviceDate}
    />
  )
}
