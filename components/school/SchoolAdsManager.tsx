'use client'

import { useState, useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Plus, Trash2, Image as ImageIcon, Video, MessageSquare, Eye, EyeOff,
  Volume2, VolumeX, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createAdAction, deleteAdAction, toggleAdActiveAction, toggleAdAudioAction, reorderAdsAction,
  createTickerAction, deleteTickerAction, toggleTickerActiveAction,
} from '@/lib/actions/ads'
import type { AdDTO, TickerMessageDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  ads: AdDTO[]
  tickers: TickerMessageDTO[]
}

const INIT: { error?: string } = {}

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

export function SchoolAdsManager({ branchId, ads, tickers }: Props) {
  const [adOpen, setAdOpen] = useState(false)
  const [tickerOpen, setTickerOpen] = useState(false)
  const [reordering, startReorder] = useTransition()

  const [adState, adFormAction, adPending] = useActionState(createAdAction, INIT)
  const [tickerState, tickerFormAction, tickerPending] = useActionState(createTickerAction, INIT)

  if (!adState.error && adState !== INIT && adOpen) setAdOpen(false)
  if (!tickerState.error && tickerState !== INIT && tickerOpen) setTickerOpen(false)

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= ads.length) return
    const ordered = ads.map((a) => a.id)
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    startReorder(async () => {
      const r = await reorderAdsAction(branchId, ordered)
      if (r.error) toast.error(r.error)
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Ads ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Display ads</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Images and videos shown on the waiting-area TVs, one at a time.
            </p>
          </div>
          <Dialog open={adOpen} onOpenChange={setAdOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-accent-600 hover:bg-accent-700 text-white">
                <Plus className="size-4" />
                Add ad
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add display ad</DialogTitle>
              </DialogHeader>
              <form action={adFormAction} className="space-y-4">
                <input type="hidden" name="branchId" value={branchId} />
                <div className="space-y-1.5">
                  <Label htmlFor="name">Title</Label>
                  <Input id="name" name="name" placeholder="Open day 2026" required maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="file">Media file</Label>
                  <Input id="file" name="file" type="file" accept="image/*,video/*" required />
                  <p className="text-xs text-muted-foreground">Image or video, up to 25 MB</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationSeconds">Duration (seconds)</Label>
                  <Input id="durationSeconds" name="durationSeconds" type="number" min={3} max={120} defaultValue={8} />
                  <p className="text-xs text-muted-foreground">
                    How long an image shows. Videos play to the end.
                  </p>
                </div>
                <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <input type="checkbox" name="audioEnabled" className="mt-0.5 size-4 accent-[var(--color-accent-600)]" />
                  <span className="text-sm">
                    <span className="font-medium text-slate-800">Play sound on the TV</span>
                    <span className="block text-xs text-muted-foreground">
                      Video only. The TV plays this ad&rsquo;s audio while it&rsquo;s on screen.
                    </span>
                  </span>
                </label>
                {adState.error && <p className="text-sm text-red-600">{adState.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAdOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={adPending} className="bg-accent-600 hover:bg-accent-700 text-white">
                    {adPending ? 'Adding…' : 'Add ad'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className={`${card} overflow-hidden`}>
          {ads.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No ads yet. Add your first one above.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ads.map((ad, i) => (
                <li key={ad.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={i === 0 || reordering}
                      onClick={() => move(i, -1)}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={i === ads.length - 1 || reordering}
                      onClick={() => move(i, 1)}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {ad.fileType === 'video'
                      ? <Video className="size-4 text-slate-500" />
                      : <ImageIcon className="size-4 text-slate-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{ad.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ad.fileType} · {ad.durationSeconds}s
                      {ad.fileType === 'video' && ad.audioEnabled ? ' · sound on' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      ad.isActive ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ad.isActive ? 'ON' : 'OFF'}
                    </span>
                    {ad.fileType === 'video' && (
                      <Button
                        variant="ghost" size="sm"
                        className="size-7 p-0 text-muted-foreground"
                        title={ad.audioEnabled ? 'Mute on TV' : 'Play sound on TV'}
                        onClick={async () => {
                          const r = await toggleAdAudioAction(ad.id, branchId)
                          if (r.error) toast.error(r.error)
                        }}
                      >
                        {ad.audioEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      className="size-7 p-0 text-muted-foreground"
                      title={ad.isActive ? 'Disable' : 'Enable'}
                      onClick={async () => {
                        const r = await toggleAdActiveAction(ad.id, branchId)
                        if (r.error) toast.error(r.error)
                      }}
                    >
                      {ad.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="size-7 p-0 text-red-600 hover:bg-red-50"
                      title="Delete"
                      onClick={async () => {
                        if (!confirm('Delete this ad?')) return
                        const r = await deleteAdAction(ad.id, branchId)
                        if (r.error) toast.error(r.error)
                        else toast.success('Ad deleted')
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Ticker messages ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Ticker messages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Scrolling text along the bottom of the board.</p>
          </div>
          <Dialog open={tickerOpen} onOpenChange={setTickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-4" />
                Add message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add ticker message</DialogTitle>
              </DialogHeader>
              <form action={tickerFormAction} className="space-y-4">
                <input type="hidden" name="branchId" value={branchId} />
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <Input
                    id="message" name="message" required maxLength={500}
                    placeholder="Fees office closes at 2 PM on Thursdays."
                  />
                </div>
                {tickerState.error && <p className="text-sm text-red-600">{tickerState.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setTickerOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={tickerPending} className="bg-accent-600 hover:bg-accent-700 text-white">
                    {tickerPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className={`${card} overflow-hidden`}>
          {tickers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No ticker messages yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickers.map((ticker) => (
                <li key={ticker.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <MessageSquare className="size-4 text-slate-500" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{ticker.message}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      ticker.isActive ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ticker.isActive ? 'ON' : 'OFF'}
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      className="size-7 p-0 text-muted-foreground"
                      onClick={async () => {
                        const r = await toggleTickerActiveAction(ticker.id, branchId)
                        if (r.error) toast.error(r.error)
                      }}
                    >
                      {ticker.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="size-7 p-0 text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm('Delete this message?')) return
                        const r = await deleteTickerAction(ticker.id, branchId)
                        if (r.error) toast.error(r.error)
                        else toast.success('Message deleted')
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
