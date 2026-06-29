'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { distributorLoginAction } from '@/lib/actions/auth'

import type { AuthResult } from '@/lib/actions/auth'
const INIT: AuthResult = {}

export function DistributorLoginForm() {
  const [state, formAction, pending] = useActionState(distributorLoginAction, INIT)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="secret">Distributor Secret</Label>
        <Input id="secret" name="secret" type="password" required placeholder="Enter secret key" />
      </div>
      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Authenticating…' : 'Sign In'}
      </Button>
    </form>
  )
}
