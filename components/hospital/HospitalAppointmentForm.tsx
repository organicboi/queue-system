'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  type ReceptionDept, type ReceptionDoc, PRIORITY_CATEGORIES, isDoctorScheduledOn, isDoctorOnLeave,
} from '@/lib/hospital/receptionShared'

export interface AppointmentFormValue {
  departmentId: string
  doctorId: string
  date: string
  time: string
  priority: string
}

interface Props {
  departments: ReceptionDept[]
  doctors: ReceptionDoc[]
  minDate: string
  defaults: Partial<AppointmentFormValue>
  submitLabel: string
  pending: boolean
  onSubmit: (v: AppointmentFormValue) => void
  onCancel?: () => void
}

// Booking and rescheduling collect the same five fields, validate the same
// way (OPD department, doctor not marked on leave that date — a weekly
// schedule mismatch is only a warning, never a block), and both post through
// slotLocal — one form, used from HospitalReception (book) and
// HospitalAppointments (reschedule).
export function HospitalAppointmentForm({
  departments, doctors, minDate, defaults, submitLabel, pending, onSubmit, onCancel,
}: Props) {
  const opdDepartments = departments.filter((d) => d.type === 'opd')
  const [departmentId, setDepartmentId] = useState(defaults.departmentId ?? opdDepartments[0]?.id ?? '')
  const [doctorId, setDoctorId] = useState(defaults.doctorId ?? '')
  const [date, setDate] = useState(defaults.date ?? minDate)
  const [time, setTime] = useState(defaults.time ?? '09:00')
  const [priority, setPriority] = useState(defaults.priority ?? '')

  const deptDoctors = doctors.filter((d) => d.departmentId === departmentId)
  const selectedDoctor = deptDoctors.find((d) => d.id === doctorId)
  // A future date the doctor has no standing weekly slot for is only a
  // heads-up, not a block — the weekly grid is a rough sketch of recurring
  // shifts, and confirming a doctor is actually in on a given day is
  // reception's call, not this form's. Only an explicit marked leave blocks.
  const offSchedule = !!selectedDoctor && !isDoctorScheduledOn(selectedDoctor, date) && !isDoctorOnLeave(selectedDoctor, date)

  function submit() {
    if (!departmentId) return
    if (!doctorId) return
    if (!date) return
    onSubmit({ departmentId, doctorId, date, time, priority })
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Department</Label>
          <select
            value={departmentId}
            onChange={(e) => { setDepartmentId(e.target.value); setDoctorId('') }}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
          >
            {opdDepartments.length === 0 && <option value="">No OPD departments</option>}
            {opdDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Doctor</Label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
          >
            <option value="">Choose doctor…</option>
            {deptDoctors.map((d) => {
              const onLeave = isDoctorOnLeave(d, date)
              return (
                <option key={d.id} value={d.id} disabled={onLeave}>
                  {d.name}{onLeave ? ' (on leave that day)' : ''}
                </option>
              )
            })}
          </select>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {offSchedule && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {selectedDoctor!.name} isn’t on their usual weekly schedule for this date — worth
          confirming they’ll actually be in before you book it.
        </p>
      )}
      <div className="space-y-1.5">
        <Label>Priority</Label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
        >
          {PRIORITY_CATEGORIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !departmentId || !doctorId}
          className="flex-1 bg-accent-600 hover:bg-accent-700 text-white"
        >
          {pending ? '…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
