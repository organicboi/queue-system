'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { onboardAction } from '@/lib/actions/auth'

import type { AuthResult } from '@/lib/actions/auth'
const INIT: AuthResult = {}

export function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboardAction, INIT)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="licenseKey">License Key</Label>
        <Input
          id="licenseKey"
          name="licenseKey"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className="font-mono uppercase tracking-widest"
          required
        />
        <p className="text-xs text-muted-foreground">Provided by your distributor</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Your Full Name</Label>
        <Input id="fullName" name="fullName" placeholder="John Smith" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} placeholder="Min. 8 characters" required />
      </div>

      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Activating…' : 'Activate & Create Account'}
      </Button>
    </form>
  )
}
