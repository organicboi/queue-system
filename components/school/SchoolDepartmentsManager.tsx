'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Sparkles, Accessibility, Power } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  createSchoolDepartmentAction,
  updateSchoolDepartmentAction,
  seedSchoolDepartmentsAction,
  type SchoolDepartmentResult,
} from '@/lib/actions/school-admin'
import type { SchoolDepartmentDTO } from '@/lib/db/school-types'

const INIT: SchoolDepartmentResult = {}

interface Props {
  branchId: string
  initialDepartments: SchoolDepartmentDTO[]
}

export function SchoolDepartmentsManager({ branchId, initialDepartments }: Props) {
  const [departments, setDepartments] = useState(initialDepartments)
  const [open, setOpen] = useState(false)
  const [createState, createAction, creating] = useActionState(createSchoolDepartmentAction, INIT)
  const [pending, startTransition] = useTransition()

  if (createState.department && departments.every((d) => d.id !== createState.department!.id)) {
    setDepartments((prev) => [...prev, createState.department!])
    setOpen(false)
  }

  function handleSeed() {
    startTransition(async () => {
      const result = await seedSchoolDepartmentsAction(branchId)
      if (result.error) toast.error(result.error)
      else if (result.created === 0) toast.info('All the default departments already exist')
      else {
        toast.success(`Added ${result.created} departments`)
        window.location.reload()
      }
    })
  }

  function handleToggle(dept: SchoolDepartmentDTO) {
    startTransition(async () => {
      const result = await updateSchoolDepartmentAction(dept.id, branchId, { isActive: !dept.isActive })
      if (result.error) toast.error(result.error)
      else {
        setDepartments((prev) => prev.map((d) => (d.id === dept.id ? result.department! : d)))
        toast.success(`${dept.nameEn} ${dept.isActive ? 'deactivated' : 'activated'}`)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent-600 hover:bg-accent-700 text-white">
              <Plus className="size-4" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Department</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="branchId" value={branchId} />
              <div className="space-y-1.5">
                <Label htmlFor="nameEn">Name</Label>
                <Input id="nameEn" name="nameEn" required maxLength={100} placeholder="Fees & Accounts" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nameAr">Name (Arabic)</Label>
                <Input id="nameAr" name="nameAr" maxLength={100} dir="rtl" placeholder="الرسوم والحسابات" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prefix">Token prefix</Label>
                  <Input
                    id="prefix" name="prefix" required maxLength={3} placeholder="F"
                    className="uppercase tabular-nums"
                  />
                  <p className="text-[11px] text-muted-foreground">1–3 letters. Tokens read F101, F102…</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numberStart">Starts at</Label>
                  <Input id="numberStart" name="numberStart" type="number" min={1} max={99999} defaultValue={101} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">Priority queue</p>
                  <p className="text-[11px] text-muted-foreground">
                    Senior citizens and visitors needing assistance jump the line
                  </p>
                </div>
                <Switch name="isPriority" />
              </div>
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

        {departments.length === 0 && (
          <Button variant="outline" onClick={handleSeed} disabled={pending}>
            <Sparkles className="size-4" />
            Load the 8 standard departments
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No departments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            The kiosk shows one button per department. Load the standard set to start.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {departments.map((dept) => (
            <li
              key={dept.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl font-black text-white tabular-nums"
                style={{ backgroundColor: dept.isActive ? dept.color : '#94A3B8' }}
                dir="ltr"
              >
                {dept.prefix}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{dept.nameEn}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {dept.nameAr && <span dir="rtl">{dept.nameAr} · </span>}
                  Numbers from {dept.numberStart}
                </p>
              </div>
              {dept.isPriority && (
                <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <Accessibility className="size-3" />
                  Priority
                </span>
              )}
              <span
                className={
                  dept.isActive
                    ? 'rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700'
                    : 'rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'
                }
              >
                {dept.isActive ? 'Active' : 'Inactive'}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => handleToggle(dept)}
              >
                <Power className="size-3.5" />
                {dept.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
