'use client'

import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Stethoscope, DoorOpen, SkipForward, Repeat, UserX, PauseCircle, CheckCircle2,
  Send, FileCheck2, Power, HeartPulse,
} from 'lucide-react'
import {
  ConsoleFrame, TaskSplit, ConfirmCancel, useNow, minutesSince, ElapsedPill,
} from '@/components/counter/console'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  hospitalCallNextAction, hospitalRecallAction, hospitalNoShowAction,
  hospitalHoldAction, hospitalDoneAction, hospitalSendToAction,
  hospitalReportReadyAction, hospitalToggleRoomOpenAction, hospitalRecordVitalsAction,
} from '@/lib/actions/hospital-tokens'
import { useHospitalRoom } from '@/lib/hooks/useHospitalRoom'
import type { HospitalRoomView } from '@/lib/actions/hospital-read'

const STAGE_LABEL: Record<string, string> = {
  registration: 'Registration', triage: 'Triage', consult: 'Consult', lab: 'Lab',
  radiology: 'Radiology', pharmacy: 'Pharmacy', billing: 'Billing', review: 'Review',
}
const PRIORITY_LABEL: Record<string, string> = {
  senior: 'Senior', emergency: 'Emergency', pregnant: 'Pregnant', 'differently-abled': 'Assistance',
}

export function HospitalRoomConsole({ roomToken, initial }: {
  roomToken: string
  initial: HospitalRoomView
}) {
  const { view, refresh, withPause } = useHospitalRoom(roomToken, initial)
  const [pending, startTransition] = useTransition()
  const now = useNow(15000)

  const run = useCallback(
    (_label: string, fn: () => Promise<{ error?: string }>, ok?: string) => {
      startTransition(async () => {
        const result = await withPause(fn)
        if (result.error) toast.error(result.error)
        else if (ok) toast.success(ok)
      })
    },
    [withPause]
  )

  const current = view.current
  const isDoctor = view.mode === 'doctor'
  const isLabLike = view.departmentType === 'lab' || view.departmentType === 'radiology'
  const isTriage = view.departmentType === 'triage'

  const headerRight = (
    <button
      type="button"
      onClick={() => run('toggle', () => hospitalToggleRoomOpenAction(roomToken).then(refreshWrap))}
      className={
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ' +
        (view.isOpen ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500')
      }
    >
      <Power className="size-3.5" />
      {view.isOpen ? 'Open' : 'Closed'}
    </button>
  )

  function refreshWrap(r: { error?: string }) {
    refresh()
    return r
  }

  if (isDoctor && view.doctorMissing) {
    return (
      <ConsoleFrame icon={Stethoscope} name={view.roomLabel ?? 'Room'} typeLabel="OPD room">
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">No doctor assigned to this room yet</p>
          <p className="text-sm">Reception sets which doctor sits here from the Rooms page.</p>
        </div>
      </ConsoleFrame>
    )
  }

  return (
    <ConsoleFrame
      icon={isDoctor ? Stethoscope : DoorOpen}
      name={view.roomLabel ?? 'Room'}
      typeLabel={
        isDoctor
          ? `${view.doctorName ?? 'Doctor'} · ${view.departmentEn ?? ''}`
          : `${STAGE_LABEL[view.departmentType ?? ''] ?? view.departmentType ?? ''} · ${view.servedToday ?? 0} done`
      }
      headerRight={headerRight}
    >
      <TaskSplit
        task={
          <div className="flex h-full flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
            {current ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-5xl font-black tabular-nums text-accent-600" dir="ltr">
                      {current.tokenCode}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {STAGE_LABEL[current.stage] ?? current.stage}
                      </span>
                      {current.priorityCategory && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          {PRIORITY_LABEL[current.priorityCategory] ?? 'Priority'}
                        </span>
                      )}
                      {current.stage === 'review' && (
                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                          Back from tests
                        </span>
                      )}
                    </div>
                  </div>
                  <ElapsedPill mins={minutesSince(current.calledAt ?? current.joinedAt, now)} />
                </div>

                {view.currentVitals && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <HeartPulse className="size-3.5" /> Vitals
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-slate-700">
                      {view.currentVitals.bpSystolic != null && (
                        <span>BP {view.currentVitals.bpSystolic}/{view.currentVitals.bpDiastolic ?? '—'}</span>
                      )}
                      {view.currentVitals.spo2 != null && <span>SpO₂ {view.currentVitals.spo2}%</span>}
                      {view.currentVitals.tempC != null && <span>Temp {view.currentVitals.tempC}°C</span>}
                      {view.currentVitals.weightKg != null && <span>Wt {view.currentVitals.weightKg} kg</span>}
                    </div>
                    {view.currentVitals.notes && <p className="mt-1 text-xs text-slate-500">{view.currentVitals.notes}</p>}
                  </div>
                )}

                {isTriage && <VitalsForm roomToken={roomToken} onSaved={refresh} disabled={pending} />}

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={pending} onClick={() => run('recall', () => hospitalRecallAction(roomToken))}>
                    <Repeat className="size-4" /> Recall
                  </Button>
                  <Button variant="outline" disabled={pending} onClick={() => run('hold', () => hospitalHoldAction(roomToken).then(refreshWrap), 'Held')}>
                    <PauseCircle className="size-4" /> Hold
                  </Button>
                  <ConfirmCancel
                    label="No show"
                    disabled={pending}
                    onConfirm={() => run('noshow', () => hospitalNoShowAction(roomToken).then(refreshWrap), 'Marked no-show')}
                  />
                  <Button
                    className="bg-accent-600 hover:bg-accent-700 text-white"
                    disabled={pending}
                    onClick={() => run('done', () => hospitalDoneAction(roomToken).then(refreshWrap), 'Done')}
                  >
                    <CheckCircle2 className="size-4" /> Done
                  </Button>
                </div>

                {isDoctor && (view.sendTargets ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <Send className="size-3" /> Send to
                    </span>
                    {(view.sendTargets ?? []).map((t) => (
                      <button
                        key={t.id}
                        disabled={pending}
                        onClick={() => run('sendto', () => hospitalSendToAction(roomToken, t.id).then(refreshWrap), `Sent to ${t.name}`)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 active:bg-slate-50 disabled:opacity-40"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                {isLabLike && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => run('review', () => hospitalReportReadyAction(roomToken).then(refreshWrap), 'Returned to doctor for review')}
                  >
                    <FileCheck2 className="size-4" /> Report ready → back to doctor
                  </Button>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <p className="text-sm text-slate-400">No token in this room</p>
                <Button
                  size="lg"
                  className="h-16 w-full bg-accent-600 hover:bg-accent-700 text-white text-lg"
                  disabled={pending || view.isOpen === false}
                  onClick={() => run('callnext', () => hospitalCallNextAction(roomToken).then(refreshWrap))}
                >
                  <SkipForward className="size-5" /> Call next
                </Button>
                {view.isOpen === false && <p className="text-xs text-amber-600">Room is closed — reopen it to call.</p>}
              </div>
            )}

            {current && (
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-full text-base"
                disabled={pending || view.isOpen === false}
                onClick={() => run('callnext', () => hospitalCallNextAction(roomToken).then(refreshWrap))}
              >
                <SkipForward className="size-5" /> Call next (finishes current)
              </Button>
            )}
          </div>
        }
        list={
          <div className="flex h-full flex-col rounded-2xl bg-white p-3 shadow-sm">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Waiting · {(view.waiting ?? []).length}
            </p>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {(view.waiting ?? []).length === 0 ? (
                <p className="px-1 text-sm text-slate-400">Nobody waiting.</p>
              ) : (
                (view.waiting ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <span className="font-mono font-bold tabular-nums text-slate-800" dir="ltr">{t.tokenCode}</span>
                    {t.priorityCategory && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {PRIORITY_LABEL[t.priorityCategory] ?? 'P'}
                      </span>
                    )}
                    {t.stage === 'review' && (
                      <span className="rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700">review</span>
                    )}
                    {t.status === 'held' && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">held</span>
                    )}
                    <span className="ms-auto">
                      <ElapsedPill mins={minutesSince(t.joinedAt, now)} />
                    </span>
                  </div>
                ))
              )}
              {(view.noShows ?? []).length > 0 && (
                <>
                  <p className="mt-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">No-shows</p>
                  {(view.noShows ?? []).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-slate-400">
                      <UserX className="size-3.5" />
                      <span className="font-mono font-bold tabular-nums" dir="ltr">{t.tokenCode}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        }
      />
    </ConsoleFrame>
  )
}

function VitalsForm({ roomToken, onSaved, disabled }: {
  roomToken: string
  onSaved: () => void
  disabled: boolean
}) {
  const [v, setV] = useState({ bpSystolic: '', bpDiastolic: '', spo2: '', tempC: '', weightKg: '', notes: '' })
  const [pending, startTransition] = useTransition()
  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  function save() {
    startTransition(async () => {
      const result = await hospitalRecordVitalsAction(roomToken, {
        bpSystolic: num(v.bpSystolic), bpDiastolic: num(v.bpDiastolic), spo2: num(v.spo2),
        tempC: num(v.tempC), weightKg: num(v.weightKg), notes: v.notes,
      })
      if (result.error) toast.error(result.error)
      else { toast.success('Vitals saved'); onSaved() }
    })
  }

  const f = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Record vitals</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Input placeholder="BP sys" inputMode="numeric" value={v.bpSystolic} onChange={f('bpSystolic')} className="h-9" />
        <Input placeholder="BP dia" inputMode="numeric" value={v.bpDiastolic} onChange={f('bpDiastolic')} className="h-9" />
        <Input placeholder="SpO₂" inputMode="numeric" value={v.spo2} onChange={f('spo2')} className="h-9" />
        <Input placeholder="Temp °C" inputMode="decimal" value={v.tempC} onChange={f('tempC')} className="h-9" />
        <Input placeholder="Wt kg" inputMode="decimal" value={v.weightKg} onChange={f('weightKg')} className="h-9" />
        <Button disabled={disabled || pending} onClick={save} className="h-9 bg-accent-600 hover:bg-accent-700 text-white">
          Save
        </Button>
      </div>
    </div>
  )
}
