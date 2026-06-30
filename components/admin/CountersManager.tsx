'use client'

import { useState, useActionState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createCounterAction,
  toggleCounterAction,
  revokeCounterAction,
  deleteCounterAction,
} from '@/lib/actions/counters'
import type { CounterActionResult } from '@/lib/actions/counters'
import { Receipt, ChefHat, Truck, Plus, Copy, RefreshCw, Trash2, ExternalLink, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import type { CounterDTO, CounterType } from '@/lib/db/types'

interface Props {
  branchId: string
  initialCounters: CounterDTO[]
}

const COUNTER_META: Record<CounterType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  billing:  { label: 'Billing',  icon: <Receipt className="size-4" />,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  kitchen:  { label: 'Kitchen',  icon: <ChefHat className="size-4" />,  color: 'text-orange-600',  bg: 'bg-orange-50'  },
  delivery: { label: 'Delivery', icon: <Truck className="size-4" />,    color: 'text-blue-600',    bg: 'bg-blue-50'    },
}

const INIT_CREATE: CounterActionResult = {}

export function CountersManager({ branchId, initialCounters }: Props) {
  const [counters, setCounters] = useState(initialCounters)
  const [open, setOpen] = useState(false)
  const [createState, createAction, createPending] = useActionState(createCounterAction, INIT_CREATE)
  const [, startTransition] = useTransition()
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)

  if (createState.counter && counters.every(c => c.id !== createState.counter!.id)) {
    setCounters(prev => [...prev, createState.counter!])
    setOpen(false)
  }

  function copyUrl(token: string) {
    const url = `${window.location.origin}/counter/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Counter URL copied!'))
  }

  function handleToggle(counterId: string) {
    startTransition(async () => {
      const result = await toggleCounterAction(counterId, branchId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCounters(prev =>
          prev.map(c => c.id === counterId ? { ...c, isActive: result.isActive ?? c.isActive } : c)
        )
        toast.success(result.isActive ? 'Counter activated' : 'Counter deactivated')
      }
    })
  }

  function handleRevoke(counterId: string) {
    startTransition(async () => {
      const result = await revokeCounterAction(counterId, branchId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCounters(prev =>
          prev.map(c => c.id === counterId ? { ...c, token: result.token ?? c.token } : c)
        )
        toast.success('Access revoked — old URL is now invalid.')
      }
      setRevokeConfirmId(null)
    })
  }

  function handleDelete(counterId: string) {
    startTransition(async () => {
      const result = await deleteCounterAction(counterId, branchId)
      if (result.error) toast.error(result.error)
      else setCounters(prev => prev.filter(c => c.id !== counterId))
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
                  defaultValue="billing"
                  className="w-full h-9 rounded-md border border-border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="billing">Billing — payment &amp; billing</option>
                  <option value="kitchen">Kitchen — food preparation</option>
                  <option value="delivery">Delivery — pickup &amp; delivery</option>
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
          <Receipt className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No counters yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a counter to generate a unique URL for your counter staff
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {counters.map((counter) => {
            const meta = COUNTER_META[counter.type]
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
                        <p className="font-semibold text-sm text-gray-900">{counter.name}</p>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                        {!counter.isActive && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-xs">
                        /counter/{counter.token}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => copyUrl(counter.token)}
                    >
                      <Copy className="size-3 mr-1" />
                      Copy URL
                    </Button>
                    <a
                      href={`/counter/${counter.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                        <ExternalLink className="size-3 mr-1" />
                        Open
                      </Button>
                    </a>

                    {/* Toggle active */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 text-xs px-2 ${counter.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                      onClick={() => handleToggle(counter.id)}
                      title={counter.isActive ? 'Deactivate counter' : 'Activate counter'}
                    >
                      {counter.isActive ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                    </Button>

                    {/* Revoke access */}
                    {revokeConfirmId === counter.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-600 font-medium">Revoke?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRevoke(counter.id)}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => setRevokeConfirmId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                        onClick={() => setRevokeConfirmId(counter.id)}
                        title="Revoke access (generate new URL)"
                      >
                        <RefreshCw className="size-3" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(counter.id)}
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
