'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createAdAction,
  deleteAdAction,
  toggleAdActiveAction,
  createTickerAction,
  deleteTickerAction,
  toggleTickerActiveAction,
} from '@/lib/actions/ads'
import { Plus, Trash2, Image, Video, MessageSquare, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import type { AdDTO, TickerMessageDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  ads: AdDTO[]
  tickers: TickerMessageDTO[]
}

const INIT: { error?: string } = {}

export function AdsManager({ branchId, ads, tickers }: Props) {
  const [adOpen, setAdOpen] = useState(false)
  const [tickerOpen, setTickerOpen] = useState(false)

  const [adState, adFormAction, adPending] = useActionState(createAdAction, INIT)
  const [tickerState, tickerFormAction, tickerPending] = useActionState(createTickerAction, INIT)

  if (!adState.error && adState !== INIT && adOpen) setAdOpen(false)
  if (!tickerState.error && tickerState !== INIT && tickerOpen) setTickerOpen(false)

  return (
    <div className="space-y-8">
      {/* ── Ads section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Display Ads</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Images and videos shown on display screens</p>
          </div>
          <Dialog open={adOpen} onOpenChange={setAdOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" />
                Add Ad
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Display Ad</DialogTitle>
              </DialogHeader>
              <form action={adFormAction} className="space-y-4">
                <input type="hidden" name="branchId" value={branchId} />
                <div className="space-y-1.5">
                  <Label htmlFor="name">Title</Label>
                  <Input id="name" name="name" placeholder="Summer Promo" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fileUrl">Media URL</Label>
                  <Input
                    id="fileUrl"
                    name="fileUrl"
                    type="url"
                    placeholder="https://…"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Direct link to image or video file</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select name="fileType" defaultValue="image">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationSeconds">Duration (seconds)</Label>
                  <Input
                    id="durationSeconds"
                    name="durationSeconds"
                    type="number"
                    min={3}
                    max={120}
                    defaultValue={8}
                  />
                </div>
                {adState.error && <p className="text-sm text-red-600">{adState.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAdOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={adPending}>
                    {adPending ? 'Adding…' : 'Add Ad'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {ads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No ads yet. Add your first display ad above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ads.map((ad) => (
                <div key={ad.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    {ad.fileType === 'video'
                      ? <Video className="size-4 text-gray-500" />
                      : <Image className="size-4 text-gray-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ad.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ad.fileType} · {ad.durationSeconds}s
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      ad.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ad.isActive ? 'ON' : 'OFF'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gray-700"
                      title={ad.isActive ? 'Disable' : 'Enable'}
                      onClick={async () => {
                        const r = await toggleAdActiveAction(ad.id, branchId)
                        if (r.error) toast.error(r.error)
                      }}
                    >
                      {ad.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ticker messages ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ticker Messages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Scrolling text shown at the bottom of the display</p>
          </div>
          <Dialog open={tickerOpen} onOpenChange={setTickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-3.5" />
                Add Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Ticker Message</DialogTitle>
              </DialogHeader>
              <form action={tickerFormAction} className="space-y-4">
                <input type="hidden" name="branchId" value={branchId} />
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <Input
                    id="message"
                    name="message"
                    placeholder="Welcome! Please have your bill number ready."
                    required
                    maxLength={500}
                  />
                </div>
                {tickerState.error && <p className="text-sm text-red-600">{tickerState.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setTickerOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={tickerPending}>
                    {tickerPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {tickers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No ticker messages yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickers.map((ticker) => (
                <div key={ticker.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <MessageSquare className="size-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{ticker.message}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      ticker.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ticker.isActive ? 'ON' : 'OFF'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gray-700"
                      onClick={async () => {
                        const r = await toggleTickerActiveAction(ticker.id, branchId)
                        if (r.error) toast.error(r.error)
                      }}
                    >
                      {ticker.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
