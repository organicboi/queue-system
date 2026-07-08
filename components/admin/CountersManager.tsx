'use client'

import { useState, useActionState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  createCounterAction,
  counterToggleAcceptingOrdersAction,
  deleteCounterAction,
} from '@/lib/actions/counters'
import type { CounterActionResult } from '@/lib/actions/counters'
import { Receipt, Plus, Copy, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { CounterDTO } from '@/lib/db/types'
import { useCounterPresence } from '@/lib/hooks/useCounterPresence'
import { formatRelativeTime } from '@/lib/queueUtils'
import { COUNTER_META } from '@/lib/counterMeta'

interface Props {
  branchId: string
  initialCounters: CounterDTO[]
  presenceEnabled?: boolean
}

const INIT_CREATE: CounterActionResult = {}

export function CountersManager({ branchId, initialCounters, presenceEnabled = false }: Props) {
  const [counters, setCounters] = useState(initialCounters)
  const presence = useCounterPresence(branchId, presenceEnabled)
  const [open, setOpen] = useState(false)
  const [createState, createAction, createPending] = useActionState(createCounterAction, INIT_CREATE)
  const [, startTransition] = useTransition()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  if (createState.counter && counters.every(c => c.id !== createState.counter!.id)) {
    setCounters(prev => [...prev, createState.counter!])
    setOpen(false)
  }

  function copyUrl(token: string) {
    const url = `${window.location.origin}/counter/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Counter URL copied!'))
  }

  function handleToggleAccepting(counterId: string, token: string) {
    startTransition(async () => {
      const result = await counterToggleAcceptingOrdersAction(token)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCounters(prev =>
          prev.map(c => c.id === counterId ? { ...c, acceptingOrders: result.acceptingOrders ?? c.acceptingOrders } : c)
        )
        toast.success(result.acceptingOrders ? 'Kitchen back online' : 'Kitchen marked offline')
      }
    })
  }

  function handleDelete(counterId: string) {
    startTransition(async () => {
      const result = await deleteCounterAction(counterId, branchId)
      if (result.error) toast.error(result.error)
      else setCounters(prev => prev.filter(c => c.id !== counterId))
      setDeleteConfirmId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {counters.length} counter{counters.length !== 1 ? 's' : ''}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Add Counter
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Counter</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="branchId" value={branchId} />
              <div className="space-y-1.5">
                <Label htmlFor="name">Counter Name</Label>
                <Input id="name" name="name" placeholder="Billing Counter 1" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="order"
                  className="w-full h-9 rounded-md border border-border bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  <option value="order">Order — take orders &amp; issue queue numbers</option>
                  <option value="kitchen">Kitchen — food preparation (optional)</option>
                  <option value="delivery">Delivery — pickup &amp; delivery (optional)</option>
                  <option value="call">Call — page any bill number directly (optional)</option>
                </select>
              </div>
              {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Creating…' : 'Create Counter'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {counters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Receipt className="size-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No counters yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a counter to generate a unique URL for your counter staff
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {counters.map((counter) => {
            const meta = COUNTER_META[counter.type]
            const live = presence.find(p => p.id === counter.id)
            const isOnline = counter.isActive && (live?.isOnline ?? false)
            return (
              <div
                key={counter.id}
                className={`rounded-xl border bg-white p-4 transition-opacity ${counter.isActive ? 'border-border' : 'border-border opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0 ${meta.color}`}>
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800">{counter.name}</p>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                        {!counter.isActive && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">
                            Inactive
                          </span>
                        )}
                        {counter.type === 'kitchen' && counter.isActive && !counter.acceptingOrders && (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700"
                            title="Kitchen staff marked themselves offline from the console — new orders bypass prep"
                          >
                            Not accepting orders
                          </span>
                        )}
                        {presenceEnabled && counter.isActive && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              isOnline ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-500'
                            }`}
                            title={isOnline ? 'Someone has this counter open right now' : 'No one appears to have this counter open'}
                          >
                            <span className={`size-1.5 rounded-full ${isOnline ? 'bg-accent-600 animate-pulse' : 'bg-slate-400'}`} />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        )}
                      </div>
                      {presenceEnabled && counter.isActive && !isOnline && live?.lastSeenAt && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Last seen {formatRelativeTime(live.lastSeenAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => copyUrl(counter.token)}
                    >
                      <Copy className="size-3 me-1" />
                      Copy URL
                    </Button>
                    <a
                      href={`/counter/${counter.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                        <ExternalLink className="size-3 me-1" />
                        Open
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  {counter.type === 'kitchen' ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        checked={counter.acceptingOrders}
                        onCheckedChange={() => handleToggleAccepting(counter.id, counter.token)}
                      />
                      <span className="text-xs font-medium text-slate-600">
                        Kitchen {counter.acceptingOrders ? 'online' : 'offline'}
                      </span>
                    </label>
                  ) : (
                    <span />
                  )}

                  {deleteConfirmId === counter.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Delete this counter?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-white bg-red-500 active:bg-red-600"
                        onClick={() => handleDelete(counter.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-600 active:bg-red-50"
                      onClick={() => setDeleteConfirmId(counter.id)}
                    >
                      <Trash2 className="size-3 me-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
