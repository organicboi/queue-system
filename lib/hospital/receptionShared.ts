// Shared between HospitalReception (patient search/detail/booking) and
// HospitalAppointments (the day-view list) — kept here rather than exported
// from one component into the other so neither file has to import the other.

export interface ReceptionDept { id: string; name: string; type: string }

export interface ReceptionDoc {
  id: string
  name: string
  departmentId: string
  feePaise: number
  onDuty: boolean
  // Which weekdays (0=Sun…6=Sat) this doctor has a schedule row for, and the
  // specific dates they're on leave — enough for the client to answer "is
  // this doctor on duty" for any date the scheduler picks, not just today.
  weekdays: number[]
  leaveDates: string[]
}

export const PRIORITY_CATEGORIES = [
  { key: '', label: 'Normal' },
  { key: 'senior', label: 'Senior (60+)' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'differently-abled', label: 'Assistance' },
  { key: 'emergency', label: 'Emergency' },
]

const pad = (n: number) => String(n).padStart(2, '0')

// The service date's calendar day plus one — NOT "24h from now", so a branch
// mid-afternoon still gets the same "tomorrow" a branch just past its
// day-start rollback would.
export function tomorrowOf(serviceDate: string): string {
  const d = new Date(`${serviceDate}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isDoctorOnDuty(doc: ReceptionDoc, date: string): boolean {
  if (!date) return false
  const weekday = new Date(`${date}T00:00:00`).getDay()
  return doc.weekdays.includes(weekday) && !doc.leaveDates.includes(date)
}

// date="2026-09-06", time="09:30" → "2026-09-06T09:30:00" — the branch's own
// wall-clock reading, no offset. book_hospital_appointment resolves this
// against the branch's timezone itself; encoding an offset here would bake in
// whichever timezone this browser (or Vercel's server process) happens to be
// in, which usually is not the branch's.
export function toSlotLocal(date: string, time: string): string {
  return `${date}T${time || '09:00'}:00`
}

// Inverse — for prefilling a reschedule form from an ISO instant. Uses the
// *viewer's* local clock (there is no branch timezone on the client to
// convert through), which is correct as long as reception is browsing from
// the branch itself — true for the desk terminal this UI is built for.
export function fromInstant(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
