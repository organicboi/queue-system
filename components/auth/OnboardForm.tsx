'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { onboardAction } from '@/lib/actions/auth'

import type { AuthResult } from '@/lib/actions/auth'
const INIT: AuthResult = {}

const inputClass = "h-10 rounded-lg border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-teal-500 focus-visible:ring-0 focus-visible:shadow-none"
const labelClass = "text-[13px] font-medium text-gray-700"

export function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboardAction, INIT)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="licenseKey" className={labelClass}>License Key</Label>
        <Input
          id="licenseKey"
          name="licenseKey"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`${inputClass} font-mono uppercase tracking-widest`}
          required
        />
        <p className="text-[12px] text-gray-400">Provided by your distributor</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName" className={labelClass}>Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="John Smith"
          className={inputClass}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className={labelClass}>Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          className={inputClass}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className={labelClass}>Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          placeholder="Min. 8 characters"
          className={inputClass}
          required
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
        {pending ? 'Activating…' : 'Activate Account'}
      </Button>
    </form>
  )
}
