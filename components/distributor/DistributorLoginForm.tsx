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
        <Label htmlFor="secret" className="text-[13px] font-medium text-gray-700">
          Distributor Secret
        </Label>
        <Input
          id="secret"
          name="secret"
          type="password"
          required
          placeholder="Enter secret key"
          className="h-10 rounded-lg border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-teal-500 focus-visible:ring-0 focus-visible:shadow-none"
        />
      </div>

      {state.error && (
        <p className="text-[13px] text-red-600">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[15px] font-medium border-0 shadow-none mt-1"
      >
        {pending ? 'Authenticating…' : 'Sign In'}
      </Button>
    </form>
  )
}
