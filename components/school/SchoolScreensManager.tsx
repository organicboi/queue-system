'use client'

import { useState, useActionState } from 'react'
import { toast } from 'sonner'
import { Plus, Copy, ExternalLink, Tv, TabletSmartphone, Smartphone } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSchoolScreenAction } from '@/lib/actions/school-admin'
import { formatRelativeTime } from '@/lib/queueUtils'
import { ProvisioningQrDialog } from './ProvisioningQrDialog'

interface Screen {
  id: string
  name: string
  screen_token: string
  last_seen_at: string | null
}

const INIT: { error?: string; screenToken?: string } = {}

export function SchoolScreensManager({ branchId, branchToken, initialScreens }: {
  branchId: string
  branchToken: string
  initialScreens: Screen[]
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createSchoolScreenAction, INIT)

  if (state.screenToken && !initialScreens.some((s) => s.screen_token === state.screenToken)) {
    // The list is server-rendered; a reload is the honest way to show the new
    // row rather than half-syncing local state.
    setOpen(false)
    window.location.reload()
  }

  function copy(url: string, what: string) {
    navigator.clipboard.writeText(url).then(() => toast.success(`${what} link copied`))
  }

  const kioskUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/school/kiosk/${branchToken}`
    : ''

  return (
    <div className="space-y-5">
      {/* Kiosk — one per branch, addressed by the branch's own token. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <TabletSmartphone className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Ticket kiosk</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Open this on the kiosk terminal in the lobby. It shows one button per department and
          prints a ticket.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(kioskUrl, 'Kiosk')}>
            <Copy className="size-3.5" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/school/kiosk/${branchToken}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open
            </a>
          </Button>
        </div>

        {/* The native Android kiosk app is provisioned with the raw token, not
            a URL — its setup screen asks for exactly this string. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Smartphone className="size-3.5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Kiosk app token</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Installing the VibeQueue Kiosk Android app on the tablet? Enter this token on its
            setup screen.
          </p>
          <div className="flex items-center gap-2">
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
          <ProvisioningQrDialog role="kiosk" token={branchToken} label="Pair the kiosk app" />
        </div>
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
                  <Input id="name" name="name" required maxLength={100} placeholder="Main Lobby TV" />
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
                    {screen.last_seen_at
                      ? `Last seen ${formatRelativeTime(screen.last_seen_at)}`
                      : 'Never opened'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(`${window.location.origin}/school/display/${screen.screen_token}`, 'Display')}
                >
                  <Copy className="size-3.5" />
                  Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/school/display/${screen.screen_token}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open
                  </a>
                </Button>
                <ProvisioningQrDialog
                  role="display"
                  token={screen.screen_token}
                  label={`Pair "${screen.name}"`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
