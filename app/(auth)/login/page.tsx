'use client'

import { useActionState } from 'react'
import { loginAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, {})

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-85">

        <div className="text-center mb-8">
          <svg
            width="32" height="32"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-900 mx-auto mb-4"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            Sign in to Queue System
          </h1>
          <p className="text-sm text-gray-500 mt-1">Admin portal</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="h-10 rounded-lg border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-teal-500 focus-visible:ring-0 focus-visible:shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                required
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
              {pending ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-gray-400 mt-5">
          Admin access only · Contact your system administrator
        </p>
      </div>
    </div>
  )
}
