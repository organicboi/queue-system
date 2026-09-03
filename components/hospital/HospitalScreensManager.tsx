'use client'

import { useState, useActionState } from 'react'
import { toast } from 'sonner'
import { Plus, Copy, ExternalLink, Tv, TabletSmartphone, DoorOpen, Smartphone } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createHospitalScreenAction, createHospitalDevicePairingCodeAction,
} from '@/lib/actions/hospital-admin'
import { formatRelativeTime } from '@/lib/queueUtils'
import { DevicePairingDialog } from '@/components/devices/DevicePairingDialog'
import { ProvisioningQrDialog } from '@/components/devices/ProvisioningQrDialog'
import type { HospitalRoomDTO } from '@/lib/db/hospital-types'

interface Screen {
  id: string
  name: string
  screen_token: string
  last_seen_at: string | null
}

const INIT: { error?: string; screenToken?: string } = {}

export function HospitalScreensManager({ branchId, branchToken, initialScreens, rooms }: {
  branchId: string
  branchToken: string
  initialScreens: Screen[]
  rooms: HospitalRoomDTO[]
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createHospitalScreenAction, INIT)

  if (state.screenToken && !initialScreens.some((s) => s.screen_token === state.screenToken)) {
    setOpen(false)
    window.location.reload()
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const copy = (url: string, what: string) =>
    navigator.clipboard.writeText(url).then(() => toast.success(`${what} link copied`))

  return (
    <div className="space-y-5">
      {/* Kiosk — one per branch, addressed by the branch's own token. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <TabletSmartphone className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Registration kiosk</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Open this on the lobby kiosk. It shows the department grid, the doctors on duty today,
          and prints a token.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(`${origin}/hospital/kiosk/${branchToken}`, 'Kiosk')}>
            <Copy className="size-3.5" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/hospital/kiosk/${branchToken}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open
            </a>
          </Button>
        </div>

        {/* The native Android kiosk app is provisioned with the raw token, not
            a URL — pair it with a 6-digit code or the provisioning QR. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Smartphone className="size-3.5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Kiosk app</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Installing the VibeQueue Kiosk Android app on the tablet? Open its setup wizard and
            type a pairing code, or scan the provisioning QR — no need to enter the long token by
            hand.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DevicePairingDialog
              role="kiosk"
              branchId={branchId}
              label="Pair the kiosk app"
              createCode={createHospitalDevicePairingCodeAction}
            />
            <ProvisioningQrDialog
              role="kiosk"
              token={branchToken}
              label="Pair the kiosk app"
              vertical="hospital"
            />
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Show the raw token</summary>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800">
                {branchToken}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(branchToken, 'Kiosk app token')}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
          </details>
        </div>
      </section>

      {/* Room consoles — one link per room; the room_token is the login. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <DoorOpen className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Room consoles</h2>
        </div>
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No rooms yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add consult rooms and service bays on the Rooms page.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{room.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {room.lastSeenAt ? `Last seen ${formatRelativeTime(room.lastSeenAt)}` : 'Never opened'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(`${origin}/hospital/room/${room.token}`, room.label)}
                >
                  <Copy className="size-3.5" />
                  Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/hospital/room/${room.token}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TV boards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Tv className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Waiting area displays</h2>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent-600 hover:bg-accent-700 text-white">
                <Plus className="size-4" />
                Add Screen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Waiting Area Display</DialogTitle>
              </DialogHeader>
              <form action={action} className="space-y-4">
                <input type="hidden" name="branchId" value={branchId} />
                <div className="space-y-1.5">
                  <Label htmlFor="name">Screen name</Label>
                  <Input id="name" name="name" required maxLength={100} placeholder="OPD Waiting Hall TV" />
                </div>
                {state.error && <p className="text-sm text-red-600">{state.error}</p>}
                <Button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-accent-600 hover:bg-accent-700 text-white"
                >
                  {pending ? 'Adding…' : 'Add Screen'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {initialScreens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No displays yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add one, then open its link on the TV browser.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {initialScreens.map((screen) => (
              <li
                key={screen.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{screen.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {screen.last_seen_at ? `Last seen ${formatRelativeTime(screen.last_seen_at)}` : 'Never opened'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(`${origin}/hospital/display/${screen.screen_token}`, 'Display')}
                >
                  <Copy className="size-3.5" />
                  Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/hospital/display/${screen.screen_token}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open
                  </a>
                </Button>
                <DevicePairingDialog
                  role="display"
                  branchId={branchId}
                  screenId={screen.id}
                  label={`Pair "${screen.name}"`}
                  createCode={createHospitalDevicePairingCodeAction}
                />
                <ProvisioningQrDialog
                  role="display"
                  token={screen.screen_token}
                  label={`Pair "${screen.name}"`}
                  vertical="hospital"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
