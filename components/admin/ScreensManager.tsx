'use client'

import { useState, useActionState, useTransition } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createScreenAction, regenerateScreenTokenAction, deleteScreenAction, updateScreenAnnouncementLangAction } from '@/lib/actions/branches'
import { setScreenAdsAction } from '@/lib/actions/ads'
import type { ScreenActionResult } from '@/lib/actions/branches'
import { Tv, Plus, Copy, RefreshCw, Trash2, ExternalLink, Megaphone, Globe } from 'lucide-react'
import { toast } from 'sonner'
import type { ScreenDTO, AnnouncementLang, AdDTO } from '@/lib/db/types'
import { defaultLocale, regionLocales } from '@/lib/region'

interface Props {
  branchId: string
  initialScreens: ScreenDTO[]
  availableAds?: AdDTO[]
  screenAdsMap?: Record<string, string[]>
}

const INIT_CREATE: ScreenActionResult = {}

export function ScreensManager({ branchId, initialScreens, availableAds = [], screenAdsMap = {} }: Props) {
  const [screens, setScreens] = useState(initialScreens)
  const [open, setOpen] = useState(false)
  const [createState, createAction, createPending] = useActionState(createScreenAction, INIT_CREATE)
  const [, startTransition] = useTransition()
  const [adsPending, setAdsPending] = useState(false)

  const [adsDialogScreenId, setAdsDialogScreenId] = useState<string | null>(null)
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([])

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

  function openAdsDialog(screen: ScreenDTO) {
    setAdsDialogScreenId(screen.id)
    setSelectedAdIds(screenAdsMap[screen.id] ?? [])
  }

  function toggleAdSelected(adId: string) {
    setSelectedAdIds(prev => prev.includes(adId) ? prev.filter(id => id !== adId) : [...prev, adId])
  }

  function handleSaveAds() {
    if (!adsDialogScreenId) return
    setAdsPending(true)
    startTransition(async () => {
      const result = await setScreenAdsAction(adsDialogScreenId, branchId, selectedAdIds)
      setAdsPending(false)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Screen ads updated')
        setAdsDialogScreenId(null)
      }
    })
  }

  const adsDialogScreen = screens.find(s => s.id === adsDialogScreenId)
  const commonAds = availableAds.filter(a => a.branchId === null)
  const branchAds = availableAds.filter(a => a.branchId !== null)

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
          <p className="text-sm font-medium text-slate-700">No screens yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a display screen to show queue numbers on a TV</p>
        </div>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => {
            const displayUrl = `/display/${screen.screenToken}`
            const pickedCount = (screenAdsMap[screen.id] ?? []).length
            return (
              <div key={screen.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Tv className="size-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{screen.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-xs">
                        {screen.screenToken}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Announce</span>
                      <select
                        value={screen.announcementLang ?? defaultLocale()}
                        onChange={(e) => handleLangChange(screen.id, e.target.value as AnnouncementLang)}
                        className="h-7 rounded-md border border-border bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent-400 cursor-pointer"
                      >
                        {regionLocales().map((l) => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                        {regionLocales().length > 1 && (
                          <option value="both">
                            {regionLocales().map((l) => l.toUpperCase()).join(' + ')}
                          </option>
                        )}
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => openAdsDialog(screen)}
                    >
                      <Megaphone className="size-3 me-1" />
                      Ads{pickedCount > 0 ? ` (${pickedCount})` : ''}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => copyUrl(screen.screenToken)}
                    >
                      <Copy className="size-3 me-1" />
                      Copy URL
                    </Button>
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                        <ExternalLink className="size-3 me-1" />
                        Open
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-amber-600 active:bg-amber-50"
                      onClick={() => handleRegenerate(screen.id)}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-600 active:bg-red-50"
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

      <Dialog open={!!adsDialogScreenId} onOpenChange={(v) => !v && setAdsDialogScreenId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ads for {adsDialogScreen?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Leave nothing checked to automatically show your branch + common ads.
            Check specific ads to show only those, in this order.
          </p>

          <div className="max-h-80 overflow-y-auto space-y-4">
            {commonAds.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Globe className="size-3" />
                  Common
                </p>
                {commonAds.map((ad) => (
                  <label key={ad.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer active:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedAdIds.includes(ad.id)}
                      onChange={() => toggleAdSelected(ad.id)}
                      className="size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                    />
                    <div className="relative size-9 rounded-md bg-slate-100 overflow-hidden shrink-0">
                      {ad.fileType === 'video' ? (
                        <video src={ad.fileUrl} className="absolute inset-0 size-full object-cover" muted playsInline />
                      ) : (
                        <Image src={ad.fileUrl} alt="" fill className="object-cover" sizes="36px" />
                      )}
                    </div>
                    <span className="flex-1 truncate text-slate-800">{ad.name}</span>
                  </label>
                ))}
              </div>
            )}

            {branchAds.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This Branch</p>
                {branchAds.map((ad) => (
                  <label key={ad.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer active:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedAdIds.includes(ad.id)}
                      onChange={() => toggleAdSelected(ad.id)}
                      className="size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                    />
                    <div className="relative size-9 rounded-md bg-slate-100 overflow-hidden shrink-0">
                      {ad.fileType === 'video' ? (
                        <video src={ad.fileUrl} className="absolute inset-0 size-full object-cover" muted playsInline />
                      ) : (
                        <Image src={ad.fileUrl} alt="" fill className="object-cover" sizes="36px" />
                      )}
                    </div>
                    <span className="flex-1 truncate text-slate-800">{ad.name}</span>
                  </label>
                ))}
              </div>
            )}

            {commonAds.length === 0 && branchAds.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No ads yet — add one from Common Ads or this branch&apos;s Ads page first.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAdsDialogScreenId(null)}>Cancel</Button>
            <Button type="button" onClick={handleSaveAds} disabled={adsPending}>
              {adsPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
