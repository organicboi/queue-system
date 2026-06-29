'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCustomerAction } from '@/lib/actions/settings'
import type { CustomerDTO } from '@/lib/db/types'

interface Props {
  customer: CustomerDTO
}

const INIT: { error?: string } = {}

export function CustomerSettingsForm({ customer }: Props) {
  const [state, formAction, pending] = useActionState(updateCustomerAction, INIT)

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold">Business Information</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" name="name" defaultValue={customer.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business Name</Label>
            <Input id="businessName" name="businessName" defaultValue={customer.businessName ?? ''} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={customer.email ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={customer.phone ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={customer.address ?? ''} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold">Branding</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="primaryColor"
                name="primaryColor"
                defaultValue={customer.primaryColor ?? '#6366f1'}
                className="w-10 h-9 rounded border border-border cursor-pointer"
              />
              <Input
                placeholder="#6366f1"
                defaultValue={customer.primaryColor ?? '#6366f1'}
                className="flex-1"
                readOnly
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" name="logoUrl" type="url" defaultValue={customer.logoUrl ?? ''} placeholder="https://..." />
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {!state.error && state !== INIT && Object.keys(state).length === 0 && (
        <p className="text-sm text-emerald-600">Settings saved successfully.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}
