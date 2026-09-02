import { redirect } from 'next/navigation'
import { getUser, getProfile } from '@/lib/dal/session'
import { logoutAction } from '@/lib/actions/auth'
import { OnboardForm } from '@/components/auth/OnboardForm'
import { LogOut } from 'lucide-react'

export default async function OnboardPage() {
  const user = await getUser()

  if (user) {
    const profile = await getProfile()
    if (profile) redirect('/dashboard')
  }

  const isTrapped = !!user

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <svg
            width="32" height="32"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-900 mx-auto mb-4"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            Activate Your Account
          </h1>
          <p className="text-sm text-gray-500 mt-1">Enter your license key to get started</p>
        </div>

        {isTrapped && (
          <div className="border border-gray-200 rounded-xl bg-white p-4 mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-gray-900">No profile found</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Your account exists but has no profile yet. Sign out and use the correct credentials.
              </p>
            </div>
            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </form>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <OnboardForm />
        </div>

        {!isTrapped && (
          <p className="text-center text-[12px] text-gray-400 mt-5">
            Already have an account?{' '}
            <a href="/login" className="text-teal-600 hover:underline">Sign in</a>
          </p>
        )}
      </div>
    </div>
  )
}
