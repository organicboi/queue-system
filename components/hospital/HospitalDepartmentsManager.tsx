'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Plus, Sparkles, Power, Pencil, Trash2, ChevronUp, ChevronDown,
  Stethoscope, HeartPulse, Bone, Baby, Eye, Brain, Ear, Smile,
  Syringe, Microscope, ScanLine, TestTube, Pill, Receipt, CreditCard,
  ClipboardList, Thermometer, Activity, UserPlus, Users, Building2,
  Cross, Accessibility, Info, type LucideIcon,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createHospitalDepartmentAction,
  editHospitalDepartmentAction,
  updateHospitalDepartmentAction,
  deleteHospitalDepartmentAction,
  reorderHospitalDepartmentsAction,
  seedHospitalDepartmentsAction,
  type HospitalDepartmentResult,
} from '@/lib/actions/hospital-admin'
import { HOSPITAL_DEPARTMENT_COLORS, HOSPITAL_DEPARTMENT_ICONS } from '@/lib/hospital/constants'
import type { HospitalDepartmentDTO, HospitalDepartmentType, HospitalQuota } from '@/lib/db/hospital-types'
import { dirFor, LOCALE_LABEL, pickLocale, regionLocales } from '@/lib/region'

const INIT: HospitalDepartmentResult = {}

const ICONS: Record<string, LucideIcon> = {
  Stethoscope, HeartPulse, Bone, Baby, Eye, Brain, Ear, Smile,
  Syringe, Microscope, ScanLine, TestTube, Pill, Receipt, CreditCard,
  ClipboardList, Thermometer, Activity, UserPlus, Users, Building2,
  Cross, Accessibility, Info,
}

const TYPE_LABEL: Record<HospitalDepartmentType, string> = {
  opd: 'OPD speciality',
  triage: 'Registration / Triage',
  lab: 'Laboratory',
  radiology: 'Radiology',
  pharmacy: 'Pharmacy',
  billing: 'Billing',
}

function DeptIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Stethoscope
  return <Icon className={className} />
}

interface Props {
  branchId: string
  initialDepartments: HospitalDepartmentDTO[]
  quota: HospitalQuota
}

export function HospitalDepartmentsManager({ branchId, initialDepartments, quota }: Props) {
  const [departments, setDepartments] = useState(initialDepartments)
  const used = departments.filter((d) => d.isActive).length
  const remaining = Math.max(0, quota.limit - used)
  const full = remaining <= 0
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HospitalDepartmentDTO | null>(null)
  const [deleting, setDeleting] = useState<HospitalDepartmentDTO | null>(null)
  const [createState, createAction, creating] = useActionState(createHospitalDepartmentAction, INIT)
  const [editState, editAction, saving] = useActionState(editHospitalDepartmentAction, INIT)
  const [lastSaved, setLastSaved] = useState<HospitalDepartmentDTO | null>(null)
  const [pending, startTransition] = useTransition()

  if (createState.department && departments.every((d) => d.id !== createState.department!.id)) {
    setDepartments((prev) => [...prev, createState.department!])
    setOpen(false)
  }
  if (editState.department && editState.department !== lastSaved) {
    setLastSaved(editState.department)
    setDepartments((prev) => prev.map((d) => (d.id === editState.department!.id ? editState.department! : d)))
    setEditing(null)
  }

  function handleSeed() {
    startTransition(async () => {
      const result = await seedHospitalDepartmentsAction(branchId)
      if (result.error) toast.error(result.error)
      else if (result.created === 0) toast.info('All the default departments already exist')
      else {
        toast.success(`Added ${result.created} departments`)
        window.location.reload()
      }
    })
  }

  function handleToggle(dept: HospitalDepartmentDTO) {
    startTransition(async () => {
      const result = await updateHospitalDepartmentAction(dept.id, branchId, { isActive: !dept.isActive })
      if (result.error) toast.error(result.error)
      else {
        setDepartments((prev) => prev.map((d) => (d.id === dept.id ? result.department! : d)))
        toast.success(`${pickLocale(dept.name, 'en')} ${dept.isActive ? 'deactivated' : 'activated'}`)
      }
    })
  }

  function handleDelete(dept: HospitalDepartmentDTO) {
    startTransition(async () => {
      const result = await deleteHospitalDepartmentAction(dept.id, branchId)
      if (result.error) {
        toast.error(result.error)
        setDeleting(null)
        return
      }
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id))
      setDeleting(null)
      toast.success(`${pickLocale(dept.name, 'en')} deleted`)
    })
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= departments.length) return
    const next = [...departments]
    ;[next[index], next[target]] = [next[target], next[index]]
    const previous = departments
    setDepartments(next)
    startTransition(async () => {
      const result = await reorderHospitalDepartmentsAction(branchId, next.map((d) => d.id))
      if (result.error) {
        setDepartments(previous)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent-600 hover:bg-accent-700 text-white" disabled={full}>
              <Plus className="size-4" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Department</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="branchId" value={branchId} />
              <DepartmentFields />
              {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
              <Button
                type="submit"
                disabled={creating}
                className="w-full bg-accent-600 hover:bg-accent-700 text-white"
              >
                {creating ? 'Adding…' : 'Add Department'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {departments.length === 0 && !full && (
          <Button variant="outline" onClick={handleSeed} disabled={pending}>
            <Sparkles className="size-4" />
            Load the standard OPD + service-point set
          </Button>
        )}
        <span className="ms-auto text-xs text-muted-foreground tabular-nums">
          {used} of {quota.limit} used
        </span>
      </div>

      {full && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {quota.limit === 0
            ? 'No departments are included in your plan. Ask your provider to assign some.'
            : `You're using all ${quota.limit} department${quota.limit === 1 ? '' : 's'} included in your plan. ` +
              'Ask your provider to assign more, or deactivate one you no longer use.'}
        </p>
      )}

      {departments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No departments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            The kiosk shows one button per OPD department. Load the standard set to start.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {departments.map((dept, index) => (
            <li
              key={dept.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-col">
                <button
                  type="button" aria-label="Move up"
                  disabled={pending || index === 0}
                  onClick={() => handleMove(index, -1)}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button" aria-label="Move down"
                  disabled={pending || index === departments.length - 1}
                  onClick={() => handleMove(index, 1)}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <div
                className="flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl font-black text-white tabular-nums"
                style={{ backgroundColor: dept.isActive ? dept.color : '#94A3B8' }}
                dir="ltr"
              >
                <DeptIcon name={dept.icon} className="size-3.5" />
                <span className="text-[11px] leading-none">{dept.prefix}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{pickLocale(dept.name, 'en')}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {regionLocales().slice(1).map((l) =>
                    dept.name?.[l] ? <span key={l} dir={dirFor(l)}>{dept.name[l]} · </span> : null
                  )}
                  {TYPE_LABEL[dept.type]} · from {dept.numberStart}
                </p>
              </div>
              <span
                className={
                  dept.isActive
                    ? 'rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700'
                    : 'rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'
                }
              >
                {dept.isActive ? 'Active' : 'Inactive'}
              </span>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(dept)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={pending || (full && !dept.isActive)}
                onClick={() => handleToggle(dept)}
              >
                <Power className="size-3.5" />
                {dept.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="outline" size="sm" disabled={pending}
                onClick={() => setDeleting(dept)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <EditDialog
        branchId={branchId}
        department={editing}
        action={editAction}
        error={editState.error}
        saving={saving}
        onClose={() => setEditing(null)}
      />

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting && pickLocale(deleting.name, 'en')}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the department and frees the prefix{' '}
            <span className="font-semibold text-slate-800" dir="ltr">{deleting?.prefix}</span>.
            It only works while the department has never issued a token — once it has, its history
            keeps it and deactivating is the way to retire it.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive" className="flex-1" disabled={pending}
              onClick={() => deleting && handleDelete(deleting)}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DepartmentFields({ department }: { department?: HospitalDepartmentDTO }) {
  const [color, setColor] = useState(department?.color ?? HOSPITAL_DEPARTMENT_COLORS[0])
  const [icon, setIcon] = useState(department?.icon ?? 'Stethoscope')

  return (
    <>
      {regionLocales().map((l, i) => (
        <div key={l} className="space-y-1.5">
          <Label htmlFor={`name_${l}`}>{i === 0 ? 'Name' : `Name (${LOCALE_LABEL[l]})`}</Label>
          <Input
            id={`name_${l}`}
            name={`name_${l}`}
            required={i === 0}
            maxLength={100}
            dir={dirFor(l)}
            placeholder={i === 0 ? 'General Medicine' : undefined}
            defaultValue={department?.name?.[l] ?? ''}
          />
        </div>
      ))}
      <div className="space-y-1.5">
        <Label htmlFor="type">Department type</Label>
        <select
          id="type" name="type"
          defaultValue={department?.type ?? 'opd'}
          className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
        >
          {(Object.keys(TYPE_LABEL) as HospitalDepartmentType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          The kiosk only shows OPD and Registration. Lab, radiology, pharmacy and billing are fed
          by transfers from the doctor console.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prefix">Token prefix</Label>
          <Input
            id="prefix" name="prefix" required maxLength={3} placeholder="GM"
            className="uppercase tabular-nums"
            defaultValue={department?.prefix}
          />
          <p className="text-[11px] text-muted-foreground">1–3 letters. Tokens read GM101, GM102…</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="numberStart">Starts at</Label>
          <Input
            id="numberStart" name="numberStart" type="number" min={1} max={99999}
            defaultValue={department?.numberStart ?? 101}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Colour</Label>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-1.5">
          {HOSPITAL_DEPARTMENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={color === c ? 'size-8 rounded-lg ring-2 ring-slate-900 ring-offset-2' : 'size-8 rounded-lg'}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <input type="hidden" name="icon" value={icon} />
        <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
          {HOSPITAL_DEPARTMENT_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => setIcon(name)}
              className={
                icon === name
                  ? 'flex aspect-square items-center justify-center rounded-lg border-2 border-accent-400 bg-accent-50 text-accent-700'
                  : 'flex aspect-square items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50'
              }
            >
              <DeptIcon name={name} className="size-4" />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function EditDialog({ branchId, department, action, error, saving, onClose }: {
  branchId: string
  department: HospitalDepartmentDTO | null
  action: (formData: FormData) => void
  error?: string
  saving: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={!!department} onOpenChange={(v) => !v && onClose()}>
      <DialogContent key={department?.id} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
        </DialogHeader>
        {department && (
          <form action={action} className="space-y-4">
            <input type="hidden" name="departmentId" value={department.id} />
            <input type="hidden" name="branchId" value={branchId} />
            <DepartmentFields department={department} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-accent-600 hover:bg-accent-700 text-white"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
