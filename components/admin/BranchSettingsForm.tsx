'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateBranchSettingsAction } from '@/lib/actions/branches'
import type { BranchDTO } from '@/lib/db/types'

interface Props {
  branch: BranchDTO
}

const INIT: { error?: string } = {}

export function BranchSettingsForm({ branch }: Props) {
  const [state, formAction, pending] = useActionState(updateBranchSettingsAction, INIT)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branch.id} />

      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold">Queue Settings</h3>

        <div className="space-y-1.5">
          <Label htmlFor="queueLabel">Queue Label</Label>
          <Input id="queueLabel" name="queueLabel" defaultValue={branch.queueLabel} placeholder="Queue Number" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maxCapacity">Max Capacity</Label>
          <Input id="maxCapacity" name="maxCapacity" type="number" min="1" max="10000" defaultValue={branch.maxCapacity} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avgServiceTime">Avg Service Time (minutes)</Label>
          <Input id="avgServiceTime" name="avgServiceTime" type="number" min="1" max="120" defaultValue={branch.avgServiceTime} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Allow Self-Join</p>
            <p className="text-xs text-muted-foreground">Customers can join queue via public link</p>
          </div>
          <input type="hidden" name="allowSelfJoin" value={branch.allowSelfJoin ? 'true' : 'false'} />
          <Switch defaultChecked={branch.allowSelfJoin} name="allowSelfJoin" value="true" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold">Display & Sound</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sound Notifications</p>
            <p className="text-xs text-muted-foreground">Play sound when calling a number</p>
          </div>
          <Switch defaultChecked={branch.soundEnabled} name="soundEnabled" value="true" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Silent Print</p>
            <p className="text-xs text-muted-foreground">Print tickets without dialog</p>
          </div>
          <Switch defaultChecked={branch.silentPrint} name="silentPrint" value="true" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tickerText">Ticker Message</Label>
          <Input id="tickerText" name="tickerText" defaultValue={branch.tickerText ?? ''} placeholder="Welcome message for display screen..." />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {!state.error && state && Object.keys(state).length === 0 && (
        <p className="text-sm text-emerald-600">Settings saved.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}
