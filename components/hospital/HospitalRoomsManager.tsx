'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Power, RefreshCw, Copy, ExternalLink } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  createHospitalRoomAction,
  editHospitalRoomAction,
  updateHospitalRoomAction,
  regenerateHospitalRoomTokenAction,
  type HospitalRoomResult,
} from '@/lib/actions/hospital-admin'
import type {
  HospitalRoomDTO, HospitalDepartmentDTO, HospitalDoctorDTO,
} from '@/lib/db/hospital-types'
import { pickLocale } from '@/lib/region'

const INIT: HospitalRoomResult = {}

interface Props {
  branchId: string
  initialRooms: HospitalRoomDTO[]
  departments: HospitalDepartmentDTO[]
  doctors: HospitalDoctorDTO[]
  quota: { limit: number; used: number; remaining: number }
}

export function HospitalRoomsManager({ branchId, initialRooms, departments, doctors, quota }: Props) {
  const [rooms, setRooms] = useState(initialRooms)
  const used = rooms.filter((r) => r.isActive).length
  const full = Math.max(0, quota.limit - used) <= 0
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HospitalRoomDTO | null>(null)
  const [createState, createAction, creating] = useActionState(createHospitalRoomAction, INIT)
  const [editState, editAction, saving] = useActionState(editHospitalRoomAction, INIT)
  const [lastSaved, setLastSaved] = useState<HospitalRoomDTO | null>(null)
  const [pending, startTransition] = useTransition()

  const dept = (id: string) => departments.find((d) => d.id === id)
  const deptName = (id: string) => {
    const d = dept(id)
    return d ? pickLocale(d.name, 'en') : 'Unknown'
  }
  const isOpd = (id: string) => dept(id)?.type === 'opd'

  if (createState.room && rooms.every((r) => r.id !== createState.room!.id)) {
    setRooms((prev) => [...prev, createState.room!])
    setOpen(false)
  }
  if (editState.room && editState.room !== lastSaved) {
    setLastSaved(editState.room)
    setRooms((prev) => prev.map((r) => (r.id === editState.room!.id ? editState.room! : r)))
    setEditing(null)
  }

  function patchRoom(roomId: string, patch: Parameters<typeof updateHospitalRoomAction>[2], okMsg?: string) {
    startTransition(async () => {
      const result = await updateHospitalRoomAction(roomId, branchId, patch)
      if (result.error) toast.error(result.error)
      else {
        setRooms((prev) => prev.map((r) => (r.id === roomId ? result.room! : r)))
        if (okMsg) toast.success(okMsg)
      }
    })
  }

  function regenerate(room: HospitalRoomDTO) {
    startTransition(async () => {
      const result = await regenerateHospitalRoomTokenAction(room.id, branchId)
      if (result.error) toast.error(result.error)
      else {
        setRooms((prev) => prev.map((r) => (r.id === room.id ? result.room! : r)))
        toast.success('Room link regenerated — the old link stops working')
      }
    })
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  if (departments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Add a department first</p>
        <p className="text-sm text-muted-foreground mt-1">Every room belongs to a department.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent-600 hover:bg-accent-700 text-white" disabled={full}>
              <Plus className="size-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Room</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="branchId" value={branchId} />
              <RoomFields departments={departments} />
              {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
              <Button type="submit" disabled={creating} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
                {creating ? 'Adding…' : 'Add Room'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <span className="ms-auto text-xs text-muted-foreground tabular-nums">
          {used} of {quota.limit} used
        </span>
      </div>

      {full && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {quota.limit === 0
            ? 'No rooms are included in your plan. Ask your provider to assign some.'
            : `You're using all ${quota.limit} room${quota.limit === 1 ? '' : 's'} included in your plan.`}
        </p>
      )}

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No rooms yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a consult room per doctor and a bay per service point.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => {
            const opdRoom = isOpd(room.departmentId)
            const roomDoctors = doctors.filter((d) => d.departmentId === room.departmentId)
            return (
              <li key={room.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{room.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{deptName(room.departmentId)}</p>
                  </div>
                  <span
                    className={
                      room.isActive
                        ? 'rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700'
                        : 'rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500'
                    }
                  >
                    {room.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Open
                    <Switch
                      checked={room.isOpen}
                      disabled={pending}
                      onCheckedChange={(v) => patchRoom(room.id, { isOpen: v })}
                    />
                  </label>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(room)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline" size="sm" disabled={pending}
                    onClick={() => patchRoom(room.id, { isActive: !room.isActive, ...(room.isActive ? { isOpen: false } : {}) },
                      `${room.label} ${room.isActive ? 'deactivated' : 'activated'}`)}
                  >
                    <Power className="size-3.5" />
                    {room.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>

                {opdRoom && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <Label htmlFor={`doc-${room.id}`} className="text-xs">Doctor this session</Label>
                    <select
                      id={`doc-${room.id}`}
                      value={room.currentDoctorId ?? ''}
                      disabled={pending}
                      onChange={(e) => patchRoom(room.id, { currentDoctorId: e.target.value || null })}
                      className="h-8 rounded border border-border bg-white px-2 text-xs"
                    >
                      <option value="">— none —</option>
                      {roomDoctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {roomDoctors.length === 0 && (
                      <span className="text-[11px] text-amber-700">No doctors in this department yet</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600">
                    /hospital/room/{room.token}
                  </code>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => navigator.clipboard.writeText(`${origin}/hospital/room/${room.token}`).then(() => toast.success('Room link copied'))}
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/hospital/room/${room.token}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => regenerate(room)}>
                    <RefreshCw className="size-3.5" />
                    New link
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent key={editing?.id}>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          {editing && (
            <form action={editAction} className="space-y-4">
              <input type="hidden" name="roomId" value={editing.id} />
              <input type="hidden" name="branchId" value={branchId} />
              <RoomFields departments={departments} room={editing} />
              {editState.error && <p className="text-sm text-red-600">{editState.error}</p>}
              <Button type="submit" disabled={saving} className="w-full bg-accent-600 hover:bg-accent-700 text-white">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoomFields({ departments, room }: {
  departments: HospitalDepartmentDTO[]
  room?: HospitalRoomDTO
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" required maxLength={60} placeholder="Room 4 / Lab Bay 2" defaultValue={room?.label} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="departmentId">Department</Label>
        <select
          id="departmentId" name="departmentId"
          defaultValue={room?.departmentId ?? departments[0]?.id}
          className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{pickLocale(d.name, 'en')}</option>
          ))}
        </select>
      </div>
    </>
  )
}
