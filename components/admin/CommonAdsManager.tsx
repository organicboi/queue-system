'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createCommonAdAction, toggleCommonAdActiveAction, deleteCommonAdAction } from '@/lib/actions/ads'
import { Plus, Trash2, Image, Video, Eye, EyeOff, Globe } from 'lucide-react'
import { toast } from 'sonner'
import type { AdDTO } from '@/lib/db/types'

interface Props {
  ads: AdDTO[]
}

const INIT: { error?: string } = {}

export function CommonAdsManager({ ads }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createCommonAdAction, INIT)

  if (!state.error && state !== INIT && open) setOpen(false)

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Common Ads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown across every branch&apos;s screens, unless a screen has its own picks
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Add Common Ad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Common Ad</DialogTitle>
            </DialogHeader>
            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Title</Label>
                <Input id="name" name="name" placeholder="Brand Campaign" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fileUrl">Media URL</Label>
                <Input id="fileUrl" name="fileUrl" type="url" placeholder="https://…" required />
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
                <Input id="durationSeconds" name="durationSeconds" type="number" min={3} max={120} defaultValue={8} />
              </div>
              {state.error && <p className="text-sm text-red-600">{state.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add Ad'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {ads.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No common ads yet. Ads added here appear on every branch.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ads.map((ad) => (
              <div key={ad.id} className="flex items-center gap-3 px-5 py-3">
                <div className="size-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  {ad.fileType === 'video' ? <Video className="size-4 text-indigo-500" /> : <Image className="size-4 text-indigo-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{ad.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold">
                      <Globe className="size-2.5" />
                      Common
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ad.fileType} · {ad.durationSeconds}s</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ad.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ad.isActive ? 'ON' : 'OFF'}
                  </span>
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-gray-700"
                    title={ad.isActive ? 'Disable' : 'Enable'}
                    onClick={async () => {
                      const r = await toggleCommonAdActiveAction(ad.id)
                      if (r.error) toast.error(r.error)
                    }}
                  >
                    {ad.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                    onClick={async () => {
                      if (!confirm('Delete this common ad? It will be removed from every branch.')) return
                      const r = await deleteCommonAdAction(ad.id)
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
  )
}
