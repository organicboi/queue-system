'use client'

import { useState, useActionState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createScreenAction, regenerateScreenTokenAction, deleteScreenAction, updateScreenAnnouncementLangAction } from '@/lib/actions/branches'
import type { ScreenActionResult } from '@/lib/actions/branches'
import { Tv, Plus, Copy, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { ScreenDTO, AnnouncementLang } from '@/lib/db/types'

interface Props {
  branchId: string
  initialScreens: ScreenDTO[]
}

const INIT_CREATE: ScreenActionResult = {}

export function ScreensManager({ branchId, initialScreens }: Props) {
  const [screens, setScreens] = useState(initialScreens)
  const [open, setOpen] = useState(false)
  const [createState, createAction, createPending] = useActionState(createScreenAction, INIT_CREATE)
  const [, startTransition] = useTransition()

  if (createState.screen && screens.every(s => s.id !== createState.screen!.id)) {
    setScreens(prev => [...prev, createState.screen!])
    setOpen(false)
  }

  function copyUrl(token: string) {
    const url = `${window.location.origin}/display/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Display URL copied!'))
  }

  function handleRegenerate(screenId: string) {
    startTransition(async () => {
      const result = await regenerateScreenTokenAction(screenId, branchId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Token regenerated. Update your display URL.')
        setScreens(prev => prev.map(s => s.id === screenId ? { ...s, screenToken: result.token ?? s.screenToken } : s))
      }
    })
  }

  function handleDelete(screenId: string) {
    startTransition(async () => {
      const result = await deleteScreenAction(screenId, branchId)
      if (result.error) toast.error(result.error)
      else setScreens(prev => prev.filter(s => s.id !== screenId))
    })
  }

  function handleLangChange(screenId: string, lang: AnnouncementLang) {
    setScreens(prev => prev.map(s => s.id === screenId ? { ...s, announcementLang: lang } : s))
    startTransition(async () => {
      const result = await updateScreenAnnouncementLangAction(screenId, branchId, lang)
      if (result.error) toast.error(result.error)
      else toast.success('Announcement language updated')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{screens.length} screen{screens.length !== 1 ? 's' : ''}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Add Screen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Display Screen</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="branchId" value={branchId} />
              <div className="space-y-1.5">
                <Label htmlFor="name">Screen Name</Label>
                <Input id="name" name="name" placeholder="Main TV" required />
              </div>
              {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Creating…' : 'Create Screen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {screens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Tv className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No screens yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a display screen to show queue numbers on a TV</p>
        </div>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => {
            const displayUrl = `/display/${screen.screenToken}`
            return (
              <div key={screen.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Tv className="size-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{screen.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-xs">
                        {screen.screenToken}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Announce</span>
                      <select
                        value={screen.announcementLang ?? 'en'}
                        onChange={(e) => handleLangChange(screen.id, e.target.value as AnnouncementLang)}
                        className="h-7 rounded-md border border-border bg-white px-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                      >
                        <option value="en">EN</option>
                        <option value="ar">AR</option>
                        <option value="both">EN + AR</option>
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => copyUrl(screen.screenToken)}
                    >
                      <Copy className="size-3 mr-1" />
                      Copy URL
                    </Button>
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                        <ExternalLink className="size-3 mr-1" />
                        Open
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                      onClick={() => handleRegenerate(screen.id)}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(screen.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>

            )
          })}
        </div>
      )}
    </div>
  )
}
