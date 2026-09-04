'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Power, CalendarClock, CalendarOff, X, Info } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createHospitalDoctorAction,
  editHospitalDoctorAction,
  updateHospitalDoctorAction,
  setHospitalDoctorScheduleAction,
  addHospitalDoctorLeaveAction,
  removeHospitalDoctorLeaveAction,
  type HospitalDoctorResult,
} from '@/lib/actions/hospital-admin'
import type {
  HospitalDoctorDTO, HospitalDoctorScheduleDTO, HospitalDoctorLeaveDTO, HospitalDepartmentDTO,
} from '@/lib/db/hospital-types'
import { pickLocale } from '@/lib/region'

const INIT: HospitalDoctorResult = {}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SESSIONS = ['am', 'pm'] as const

interface Props {
  branchId: string
  initialDoctors: HospitalDoctorDTO[]
  opdDepartments: HospitalDepartmentDTO[]
}

export function HospitalDoctorsManager({ branchId, initialDoctors, opdDepartments }: Props) {
  const [doctors, setDoctors] = useState(initialDoctors)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HospitalDoctorDTO | null>(null)
  const [scheduling, setScheduling] = useState<HospitalDoctorDTO | null>(null)
  const [leaving, setLeaving] = useState<HospitalDoctorDTO | null>(null)
  const [createState, createAction, creating] = useActionState(createHospitalDoctorAction, INIT)
  const [editState, editAction, saving] = useActionState(editHospitalDoctorAction, INIT)
  const [lastSaved, setLastSaved] = useState<HospitalDoctorDTO | null>(null)
  const [pending, startTransition] = useTransition()

  const deptName = (id: string) => {
    const d = opdDepartments.find((x) => x.id === id)
    return d ? pickLocale(d.name, 'en') : 'Unknown department'
  }

  if (createState.doctor && doctors.every((d) => d.id !== createState.doctor!.id)) {
    setDoctors((prev) => [...prev, { ...createState.doctor!, schedules: [], leaves: [] }])
    setOpen(false)
  }
  if (editState.doctor && editState.doctor !== lastSaved) {
    setLastSaved(editState.doctor)
    setDoctors((prev) => prev.map((d) =>
      d.id === editState.doctor!.id ? { ...editState.doctor!, schedules: d.schedules, leaves: d.leaves } : d))
    setEditing(null)
  }

  function handleToggle(doc: HospitalDoctorDTO) {
    startTransition(async () => {
      const result = await updateHospitalDoctorAction(doc.id, branchId, { isActive: !doc.isActive })
      if (result.error) toast.error(result.error)
      else {
        setDoctors((prev) => prev.map((d) =>
          d.id === doc.id ? { ...result.doctor!, schedules: d.schedules, leaves: d.leaves } : d))
        toast.success(`${doc.name} ${doc.isActive ? 'deactivated' : 'activated'}`)
      }
    })
  }

  function applySchedules(doctorId: string, schedules: HospitalDoctorScheduleDTO[]) {
    setDoctors((prev) => prev.map((d) => (d.id === doctorId ? { ...d, schedules } : d)))
  }
  function applyLeaves(doctorId: string, leaves: HospitalDoctorLeaveDTO[]) {
    setDoctors((prev) => prev.map((d) => (d.id === doctorId ? { ...d, leaves } : d)))
  }

  if (opdDepartments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Add an OPD department first</p>
        <p className="text-sm text-muted-foreground mt-1">
          Doctors belong to an OPD speciality. Create one on the Departments page, then come back.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-accent-600 hover:bg-accent-700 text-white">
            <Plus className="size-4" />
            Add Doctor
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
          </DialogHeader>
          <form action={createAction} className="space-y-4">
            <input type="hidden" name="branchId" value={branchId} />
            <DoctorFields opdDepartments={opdDepartments} />
            {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
            <Button type="submit" disabled={creating} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
              {creating ? 'Adding…' : 'Add Doctor'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {doctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No doctors yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add the doctors who run OPD clinics here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {doctors.map((doc) => (
            <li key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{doc.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {deptName(doc.departmentId)}
                    {doc.specialization ? ` · ${doc.specialization}` : ''}
                    {` · ${doc.avgConsultMinutes} min avg`}
                    {doc.feePaise > 0 ? ` · ₹${(doc.feePaise / 100).toFixed(0)}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {(doc.schedules ?? []).length === 0
                      ? 'No schedule — will not appear on the kiosk'
                      : (doc.schedules ?? [])
                          .slice()
                          .sort((a, b) => a.weekday - b.weekday || a.session.localeCompare(b.session))
                          .map((s) => `${WEEKDAYS[s.weekday]} ${s.session.toUpperCase()}`)
                          .join(', ')}
                    {(doc.leaves ?? []).length > 0 && ` · ${(doc.leaves ?? []).length} leave day(s)`}
                  </p>
                </div>
                <span
                  className={
                    doc.isActive
                      ? 'rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700'
                      : 'rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'
                  }
                >
                  {doc.isActive ? 'Active' : 'Inactive'}
                </span>
                <Button variant="outline" size="sm" onClick={() => setScheduling(doc)}>
                  <CalendarClock className="size-3.5" />
                  Schedule
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLeaving(doc)}>
                  <CalendarOff className="size-3.5" />
                  Leaves
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(doc)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => handleToggle(doc)}>
                  <Power className="size-3.5" />
                  {doc.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent key={editing?.id} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>
          {editing && (
            <form action={editAction} className="space-y-4">
              <input type="hidden" name="doctorId" value={editing.id} />
              <input type="hidden" name="branchId" value={branchId} />
              <DoctorFields opdDepartments={opdDepartments} doctor={editing} />
              {editState.error && <p className="text-sm text-red-600">{editState.error}</p>}
              <Button type="submit" disabled={saving} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {scheduling && (
        <ScheduleDialog
          branchId={branchId}
          doctor={scheduling}
          onClose={() => setScheduling(null)}
          onSaved={(rows) => { applySchedules(scheduling.id, rows); setScheduling(null) }}
        />
      )}
      {leaving && (
        <LeavesDialog
          branchId={branchId}
          doctor={leaving}
          onClose={() => setLeaving(null)}
          onChange={(rows) => applyLeaves(leaving.id, rows)}
        />
      )}
    </div>
  )
}

function DoctorFields({ opdDepartments, doctor }: {
  opdDepartments: HospitalDepartmentDTO[]
  doctor?: HospitalDoctorDTO
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={120} placeholder="Dr. Sharma" defaultValue={doctor?.name} />
        <p className="text-[11px] text-muted-foreground">Shown on the board and room console — never a patient name.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="departmentId">Department</Label>
        <select
          id="departmentId" name="departmentId"
          defaultValue={doctor?.departmentId ?? opdDepartments[0]?.id}
          className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
        >
          {opdDepartments.map((d) => (
            <option key={d.id} value={d.id}>{pickLocale(d.name, 'en')}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="specialization">Specialization (optional)</Label>
        <Input id="specialization" name="specialization" maxLength={120} placeholder="MD, Diabetology" defaultValue={doctor?.specialization} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="feeRupees">Consultation fee (₹)</Label>
          <Input
            id="feeRupees" name="feeRupees" type="number" min={0} max={100000}
            defaultValue={doctor ? doctor.feePaise / 100 : 0}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="avgConsultMinutes">Avg consult (min)</Label>
          <Input
            id="avgConsultMinutes" name="avgConsultMinutes" type="number" min={1} max={120}
            defaultValue={doctor?.avgConsultMinutes ?? 10}
          />
        </div>
      </div>
    </>
  )
}

interface DraftRow { on: boolean; startTime: string; endTime: string; slotMinutes: number; maxTokens: number }
const SESSION_LABEL: Record<(typeof SESSIONS)[number], string> = { am: 'Morning', pm: 'Evening' }
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function ScheduleDialog({ branchId, doctor, onClose, onSaved }: {
  branchId: string
  doctor: HospitalDoctorDTO
  onClose: () => void
  onSaved: (rows: HospitalDoctorScheduleDTO[]) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const key = (weekday: number, session: string) => `${weekday}-${session}`
  const [rows, setRows] = useState<Record<string, DraftRow>>(() => {
    const out: Record<string, DraftRow> = {}
    for (let w = 0; w < 7; w++) {
      for (const s of SESSIONS) {
        const existing = (doctor.schedules ?? []).find((r) => r.weekday === w && r.session === s)
        out[key(w, s)] = existing
          ? {
              on: true,
              startTime: existing.startTime.slice(0, 5),
              endTime: existing.endTime.slice(0, 5),
              slotMinutes: existing.slotMinutes,
              maxTokens: existing.maxTokens,
            }
          : {
              on: false,
              startTime: s === 'am' ? '09:00' : '17:00',
              endTime: s === 'am' ? '13:00' : '20:00',
              slotMinutes: 15,
              maxTokens: 40,
            }
      }
    }
    return out
  })

  // A quick-fill draft per session, so setting up the common case — the same
  // hours every working day — isn't 7 rounds of retyping the same times.
  const [fill, setFill] = useState<Record<(typeof SESSIONS)[number], Omit<DraftRow, 'on'>>>({
    am: { startTime: '09:00', endTime: '13:00', slotMinutes: 15, maxTokens: 40 },
    pm: { startTime: '17:00', endTime: '20:00', slotMinutes: 15, maxTokens: 40 },
  })

  function patch(k: string, p: Partial<DraftRow>) {
    setRows((prev) => ({ ...prev, [k]: { ...prev[k], ...p } }))
  }

  function applyFill(session: (typeof SESSIONS)[number], weekdays: number[]) {
    setRows((prev) => {
      const next = { ...prev }
      for (const w of weekdays) next[key(w, session)] = { on: true, ...fill[session] }
      return next
    })
  }

  function save() {
    setError(null)
    const payload = Object.entries(rows)
      .filter(([, r]) => r.on)
      .map(([k, r]) => {
        const [weekday, session] = k.split('-')
        return {
          weekday: Number(weekday),
          session: session as 'am' | 'pm',
          startTime: r.startTime,
          endTime: r.endTime,
          slotMinutes: r.slotMinutes,
          maxTokens: r.maxTokens,
        }
      })
    startTransition(async () => {
      const result = await setHospitalDoctorScheduleAction(doctor.id, branchId, payload)
      if (result.error) setError(result.error)
      else {
        toast.success('Schedule saved')
        onSaved(result.schedules ?? [])
      }
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{doctor.name} — weekly schedule</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Turn on the sessions this doctor sees patients in. A day with nothing turned on means
          they won’t show up on the kiosk, or be pre-selected as on duty, for that day.
        </p>

        {/* Quick fill — the common case is the same hours every working day */}
        <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5 sm:grid-cols-2">
          {SESSIONS.map((s) => (
            <div key={s} className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">{SESSION_LABEL[s]} quick fill</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="time" value={fill[s].startTime}
                  onChange={(e) => setFill((prev) => ({ ...prev, [s]: { ...prev[s], startTime: e.target.value } }))}
                  className="h-8 min-w-0 flex-1 rounded border border-border px-1.5 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  type="time" value={fill[s].endTime}
                  onChange={(e) => setFill((prev) => ({ ...prev, [s]: { ...prev[s], endTime: e.target.value } }))}
                  className="h-8 min-w-0 flex-1 rounded border border-border px-1.5 text-xs"
                />
              </div>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-[11px]"
                  onClick={() => applyFill(s, [1, 2, 3, 4, 5, 6])}>
                  Apply Mon–Sat
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-[11px]"
                  onClick={() => applyFill(s, [0, 1, 2, 3, 4, 5, 6])}>
                  Apply all 7 days
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, w) => (
            <div key={w} className="rounded-xl border border-slate-200 p-2.5">
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{WEEKDAY_FULL[w]}</p>
              <div className="space-y-2">
                {SESSIONS.map((s) => {
                  const k = key(w, s)
                  const r = rows[k]
                  return (
                    <div key={s} className={'rounded-lg border px-2 py-1.5 ' + (r.on ? 'border-accent-200 bg-accent-50/40' : 'border-slate-200')}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={r.on}
                          onCheckedChange={(v) => patch(k, { on: v })}
                          aria-label={`${SESSION_LABEL[s]} session on ${WEEKDAY_FULL[w]}`}
                        />
                        <span className="text-xs font-medium text-slate-700">{SESSION_LABEL[s]} ({s.toUpperCase()})</span>
                      </div>
                      {r.on && (
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground">Start</span>
                            <input
                              type="time" value={r.startTime}
                              onChange={(e) => patch(k, { startTime: e.target.value })}
                              className="h-8 w-full rounded border border-border px-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground">End</span>
                            <input
                              type="time" value={r.endTime}
                              onChange={(e) => patch(k, { endTime: e.target.value })}
                              className="h-8 w-full rounded border border-border px-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              Planned patients
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="What is this?">
                                    <Info className="size-2.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  How many patients you expect to see in this session — for your own
                                  planning. It doesn’t stop tokens or bookings once reached.
                                </TooltipContent>
                              </Tooltip>
                            </span>
                            <input
                              type="number" min={1} max={500} value={r.maxTokens}
                              onChange={(e) => patch(k, { maxTokens: Number(e.target.value) })}
                              className="h-8 w-full rounded border border-border px-1.5 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={save} disabled={pending} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
          {pending ? 'Saving…' : 'Save Schedule'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function LeavesDialog({ branchId, doctor, onClose, onChange }: {
  branchId: string
  doctor: HospitalDoctorDTO
  onClose: () => void
  onChange: (rows: HospitalDoctorLeaveDTO[]) => void
}) {
  const [leaves, setLeaves] = useState<HospitalDoctorLeaveDTO[]>(doctor.leaves ?? [])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function add() {
    if (!date) return
    startTransition(async () => {
      const result = await addHospitalDoctorLeaveAction(doctor.id, branchId, date, reason)
      if (result.error) toast.error(result.error)
      else {
        const next = [...leaves, result.leave!].sort((a, b) => a.leaveDate.localeCompare(b.leaveDate))
        setLeaves(next)
        onChange(next)
        setDate('')
        setReason('')
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeHospitalDoctorLeaveAction(id, branchId)
      if (result.error) toast.error(result.error)
      else {
        const next = leaves.filter((l) => l.id !== id)
        setLeaves(next)
        onChange(next)
      }
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{doctor.name} — leave days</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="leaveDate" className="text-xs">Date</Label>
            <Input id="leaveDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="leaveReason" className="text-xs">Reason (optional)</Label>
            <Input id="leaveReason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className="h-9" />
          </div>
          <Button onClick={add} disabled={pending || !date} size="sm" className="bg-accent-600 hover:bg-accent-700 text-white">
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave days marked.</p>
        ) : (
          <ul className="space-y-1.5">
            {leaves.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium tabular-nums">{l.leaveDate}</span>
                {l.reason && <span className="truncate text-muted-foreground">— {l.reason}</span>}
                <button
                  type="button"
                  onClick={() => remove(l.id)}
                  disabled={pending}
                  className="ms-auto text-slate-400 hover:text-red-600"
                  aria-label="Remove leave"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          On a marked day the kiosk hides this doctor and rejects any walk-in token for them.
        </p>
      </DialogContent>
    </Dialog>
  )
}
