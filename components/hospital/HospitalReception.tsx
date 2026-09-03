'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Search, UserPlus, Ticket, RotateCcw, Ban, Phone, IdCard, CalendarDays,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  searchHospitalPatientsAction,
  getHospitalPatientDetailAction,
  registerHospitalPatientAction,
  receptionIssueTokenAction,
  receptionCancelTokenAction,
  receptionRejoinTokenAction,
} from '@/lib/actions/hospital-reception'
import type { HospitalPatientDetail } from '@/lib/dal/hospital'
import type { HospitalPatientDTO } from '@/lib/db/hospital-types'

const PRIORITY_CATEGORIES = [
  { key: '', label: 'Normal' },
  { key: 'senior', label: 'Senior (60+)' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'differently-abled', label: 'Assistance' },
  { key: 'emergency', label: 'Emergency' },
]
const STAGE_LABEL: Record<string, string> = {
  registration: 'Registration', triage: 'Triage', consult: 'Consult', lab: 'Lab',
  radiology: 'Radiology', pharmacy: 'Pharmacy', billing: 'Billing', review: 'Review',
}
const OPEN_STATUSES = ['waiting', 'called', 'serving', 'held', 'no-show']

interface Dept { id: string; name: string; type: string }
interface Doc { id: string; name: string; departmentId: string; feePaise: number; onDuty: boolean }

interface Props {
  branchId: string
  serviceDate: string
  departments: Dept[]
  doctors: Doc[]
}

const REG_INIT: { patient?: HospitalPatientDTO; error?: string } = {}

export function HospitalReception({ branchId, serviceDate, departments, doctors }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HospitalPatientDTO[]>([])
  const [searching, startSearch] = useTransition()
  const [detail, setDetail] = useState<HospitalPatientDetail | null>(null)
  const [loadingDetail, startDetail] = useTransition()
  const [regOpen, setRegOpen] = useState(false)
  const [regState, regAction, registering] = useActionState(registerHospitalPatientAction, REG_INIT)

  if (regState.patient && !results.some((p) => p.id === regState.patient!.id)) {
    setResults((prev) => [regState.patient!, ...prev])
    setRegOpen(false)
    openDetail(regState.patient.id)
  }

  function runSearch() {
    if (!query.trim()) return
    startSearch(async () => {
      const res = await searchHospitalPatientsAction(branchId, query.trim())
      if (res.error) toast.error(res.error)
      else setResults(res.patients ?? [])
    })
  }

  function openDetail(patientId: string) {
    startDetail(async () => {
      const res = await getHospitalPatientDetailAction(branchId, patientId)
      if (res.error) toast.error(res.error)
      else setDetail(res.detail ?? null)
    })
  }

  function reloadDetail() {
    if (detail) openDetail(detail.patient.id)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Search + register */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="UHID, phone or name"
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={runSearch} disabled={searching}>
            {searching ? '…' : 'Search'}
          </Button>
        </div>

        <Dialog open={regOpen} onOpenChange={setRegOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-accent-600 hover:bg-accent-700 text-white">
              <UserPlus className="size-4" /> Register new patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register patient</DialogTitle>
            </DialogHeader>
            <form action={regAction} className="space-y-3">
              <input type="hidden" name="branchId" value={branchId} />
              <Field name="name" label="Full name" required />
              <div className="grid grid-cols-2 gap-3">
                <Field name="phone" label="Phone" type="tel" />
                <Field name="uhid" label="UHID (optional)" placeholder="auto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field name="dob" label="Date of birth" type="date" />
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gender</Label>
                  <select id="gender" name="gender" className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm">
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <Field name="abhaNumber" label="ABHA number (optional)" />
              <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
                <input type="checkbox" name="consent" className="mt-0.5" />
                <span className="text-slate-700">
                  The patient consents to their details being stored for this visit and its records,
                  including across this hospital group’s branches (DPDP Act 2023).
                </span>
              </label>
              {regState.error && <p className="text-sm text-red-600">{regState.error}</p>}
              <Button type="submit" disabled={registering} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
                {registering ? 'Registering…' : 'Register'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <ul className="space-y-1.5">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => openDetail(p.id)}
                className={
                  'w-full rounded-xl border px-3 py-2 text-left text-sm ' +
                  (detail?.patient.id === p.id ? 'border-accent-400 bg-accent-50' : 'border-slate-200 bg-white')
                }
              >
                <span className="font-semibold text-slate-800">{p.name}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><IdCard className="size-3" />{p.uhid}</span>
                  {p.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{p.phone}</span>}
                </span>
              </button>
            </li>
          ))}
          {query && !searching && results.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-muted-foreground">
              No patients match. Register a new one.
            </li>
          )}
        </ul>
      </div>

      {/* Detail */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">Search for a patient, or register a new one.</p>
        ) : (
          <PatientDetail
            key={detail.patient.id}
            branchId={branchId}
            serviceDate={serviceDate}
            detail={detail}
            departments={departments}
            doctors={doctors}
            onChange={reloadDetail}
          />
        )}
      </div>
    </div>
  )
}

function Field({ name, label, required, type = 'text', placeholder }: {
  name: string; label: string; required?: boolean; type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} type={type} placeholder={placeholder} />
    </div>
  )
}

function PatientDetail({ branchId, serviceDate, detail, departments, doctors, onChange }: {
  branchId: string
  serviceDate: string
  detail: HospitalPatientDetail
  departments: Dept[]
  doctors: Doc[]
  onChange: () => void
}) {
  const { patient, visits, tokens } = detail
  const [pending, startTransition] = useTransition()
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '')
  const [doctorId, setDoctorId] = useState('')
  const [priority, setPriority] = useState('')
  const [visitType, setVisitType] = useState<'new' | 'followup'>('new')

  const selectedDept = departments.find((d) => d.id === deptId)
  const deptDoctors = doctors.filter((d) => d.departmentId === deptId)
  const needsDoctor = selectedDept?.type === 'opd'

  const openTokens = tokens.filter((t) => t.serviceDate === serviceDate && OPEN_STATUSES.includes(t.status))

  function issue() {
    if (needsDoctor && !doctorId) { toast.error('Choose a doctor'); return }
    startTransition(async () => {
      const res = await receptionIssueTokenAction({
        branchId, patientId: patient.id, departmentId: deptId,
        doctorId: needsDoctor ? doctorId : null,
        priorityCategory: priority || null,
        visitType,
      })
      if (res.error) toast.error(res.error)
      else { toast.success(`Token ${res.token?.tokenCode} issued`); onChange() }
    })
  }

  function amend(fn: () => Promise<{ error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else { toast.success(ok); onChange() }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-bold text-slate-900">{patient.name}</p>
        <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><IdCard className="size-3" />{patient.uhid}</span>
          {patient.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{patient.phone}</span>}
          {patient.dob && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{patient.dob}</span>}
          {patient.gender && <span className="capitalize">{patient.gender}</span>}
        </p>
      </div>

      {/* Issue a token */}
      <section className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Ticket className="size-4" /> Issue a token
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setDoctorId('') }}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {needsDoctor && (
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
              <option value="">Choose doctor…</option>
              {deptDoctors.map((d) => (
                <option key={d.id} value={d.id} disabled={!d.onDuty}>
                  {d.name}{d.onDuty ? '' : ' (not on duty today)'}
                </option>
              ))}
            </select>
          )}
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
            {PRIORITY_CATEGORIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value as 'new' | 'followup')}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
            <option value="new">New visit</option>
            <option value="followup">Follow-up</option>
          </select>
        </div>
        <Button onClick={issue} disabled={pending} className="mt-2 w-full bg-accent-600 hover:bg-accent-700 text-white">
          Issue token
        </Button>
      </section>

      {/* Today's open tokens */}
      {openTokens.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Today</p>
          <ul className="space-y-1.5">
            {openTokens.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <span className="font-mono font-bold tabular-nums text-slate-800" dir="ltr">{t.tokenCode}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {STAGE_LABEL[t.stage] ?? t.stage}
                </span>
                <span className="text-[11px] text-slate-500">{t.status}</span>
                <span className="ms-auto flex gap-1.5">
                  {t.status === 'no-show' && (
                    <button
                      onClick={() => amend(() => receptionRejoinTokenAction(branchId, t.id), `${t.tokenCode} rejoined`)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600"
                    >
                      <RotateCcw className="size-3" /> Rejoin
                    </button>
                  )}
                  {t.status !== 'served' && t.status !== 'cancelled' && (
                    <button
                      onClick={() => amend(() => receptionCancelTokenAction(branchId, t.id), `${t.tokenCode} cancelled`)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600"
                    >
                      <Ban className="size-3" /> Cancel
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Visit history */}
      <section>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Visits</p>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {visits.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="tabular-nums text-slate-700">{v.visitDate}</span>
                <span className="text-[11px] text-slate-400">{v.type} · {v.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-slate-400">
        Consent captured {new Date(patient.consentAt).toLocaleDateString()}. Every open of this
        record is logged.
      </p>
    </div>
  )
}
