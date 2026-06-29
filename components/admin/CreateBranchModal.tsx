'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBranchAction } from '@/lib/actions/branches'
import { Plus } from 'lucide-react'

import type { BranchActionResult } from '@/lib/actions/branches'
const INIT: BranchActionResult = {}

export function CreateBranchModal() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createBranchAction, INIT)

  if (state.branch && open) {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          New Branch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Branch Name</Label>
            <Input id="name" name="name" placeholder="Main Branch" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locationNote">Location Note <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="locationNote" name="locationNote" placeholder="Ground Floor, Building A" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="queueLabel">Queue Label <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="queueLabel" name="queueLabel" placeholder="Queue Number" />
          </div>
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Branch'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
