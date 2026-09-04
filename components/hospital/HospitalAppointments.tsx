'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Ban, Pencil, Phone, IdCard, Stethoscope } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getHospitalAppointmentsForDateAction,
  rescheduleHospitalAppointmentAction,
  cancelHospitalAppointmentAction,
} from '@/lib/actions/hospital-reception'
import { HospitalAppointmentForm } from '@/components/hospital/HospitalAppointmentForm'
import {
  type ReceptionDept, type ReceptionDoc, tomorrowOf, fromInstant, formatSlot, toSlotLocal,
} from '@/lib/hospital/receptionShared'
import type { HospitalAppointmentListItemDTO } from '@/lib/db/hospital-types'

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting', called: 'Called', serving: 'In room', held: 'Held',
  served: 'Served', 'no-show': 'No-show', cancelled: 'Cancelled',
}

interface Props {
  branchId: string
  serviceDate: string
  departments: ReceptionDept[]
  doctors: ReceptionDoc[]
}

export function HospitalAppointments({ branchId, serviceDate, departments, doctors }: Props) {
  const [date, setDate] = useState(tomorrowOf(serviceDate))
  const [items, setItems] = useState<HospitalAppointmentListItemDTO[]>([])
  const [loading, startLoad] = useTransition()
  const [editing, setEditing] = useState<HospitalAppointmentListItemDTO | null>(null)

  function load(forDate: string) {
    startLoad(async () => {
      const res = await getHospitalAppointmentsForDateAction(branchId, forDate)
      if (res.error) toast.error(res.error)
      else setItems(res.items ?? [])
    })
  }

  useEffect(() => { load(date) }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="apptDate" className="text-xs text-slate-500">Date</Label>
        <Input
          id="apptDate" type="date" value={date} min={serviceDate}
          onChange={(e) => setDate(e.target.value)} className="w-auto"
        />
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {!loading && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-muted-foreground">
          No appointments booked for {date}.
        </p>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.token.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold tabular-nums text-slate-800" dir="ltr">{item.token.tokenCode}</span>
              <span className="font-semibold text-slate-800">{item.patientName}</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <IdCard className="size-3" />{item.patientUhid}
              </span>
              {item.patientPhone && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Phone className="size-3" />{item.patientPhone}
                </span>
              )}
              <span className="ms-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {STATUS_LABEL[item.token.status] ?? item.token.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><Stethoscope className="size-3" />{item.doctorName}</span>
              <span>{formatSlot(item.appointment.slotTime)}</span>
              {item.token.priorityCategory && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
                  {item.token.priorityCategory}
                </span>
              )}
              {item.appointment.status === 'cancelled' || item.token.status === 'cancelled' ? null : (
                <span className="ms-auto flex gap-1.5">
                  <button
                    onClick={() => setEditing(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-600"
                  >
                    <Pencil className="size-3" /> Reschedule
                  </button>
                  <CancelButton
                    branchId={branchId}
                    appointmentId={item.appointment.id}
                    tokenCode={item.token.tokenCode}
                    onDone={() => load(date)}
                  />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule {editing?.token.tokenCode}</DialogTitle>
          </DialogHeader>
          {editing && (
            <RescheduleForm
              branchId={branchId}
              serviceDate={serviceDate}
              departments={departments}
              doctors={doctors}
              item={editing}
              onDone={() => { setEditing(null); load(date) }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CancelButton({ branchId, appointmentId, tokenCode, onDone }: {
  branchId: string; appointmentId: string; tokenCode: string; onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => {
        const res = await cancelHospitalAppointmentAction(branchId, appointmentId)
        if (res.error) toast.error(res.error)
        else { toast.success(`${tokenCode} cancelled`); onDone() }
      })}
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 font-medium text-red-600"
    >
      <Ban className="size-3" /> Cancel
    </button>
  )
}

function RescheduleForm({ branchId, serviceDate, departments, doctors, item, onDone, onCancel }: {
  branchId: string
  serviceDate: string
  departments: ReceptionDept[]
  doctors: ReceptionDoc[]
  item: HospitalAppointmentListItemDTO
  onDone: () => void
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()
  const { date, time } = fromInstant(item.appointment.slotTime)

  return (
    <HospitalAppointmentForm
      departments={departments}
      doctors={doctors}
      minDate={serviceDate}
      defaults={{
        departmentId: item.token.departmentId, doctorId: item.appointment.doctorId,
        date, time, priority: item.token.priorityCategory ?? '',
      }}
      submitLabel="Save"
      pending={pending}
      onCancel={onCancel}
      onSubmit={(v) => startTransition(async () => {
        const res = await rescheduleHospitalAppointmentAction({
          branchId,
          appointmentId: item.appointment.id,
          departmentId: v.departmentId,
          doctorId: v.doctorId,
          slotLocal: toSlotLocal(v.date, v.time),
          priorityCategory: v.priority || null,
        })
        if (res.error) toast.error(res.error)
        else { toast.success(`Rescheduled to ${res.token?.tokenCode}`); onDone() }
      })}
    />
  )
}
