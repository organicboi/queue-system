import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'
import { logoutAction } from '@/lib/actions/auth'
import { OnboardForm } from '@/components/auth/OnboardForm'
import { ListOrdered, LogOut } from 'lucide-react'

export default async function OnboardPage() {
  const session = await getSession()

  // Already fully onboarded — send them to the app
  if (session) {
    const profile = await getProfile()
    if (profile) redirect('/dashboard')
  }

  // session exists but no profile — user is logged in as an orphaned account
  const isTrapped = !!session

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <ListOrdered className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Activate Your Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your license key to get started</p>
        </div>

        {isTrapped && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Signed in without a profile</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your account exists but has no profile yet. Sign out and log in with the correct credentials.
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="size-3" />
                Sign out
              </button>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-white shadow-sm p-8">
          <OnboardForm />
        </div>

        {!isTrapped && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-primary hover:underline font-medium">Sign in</a>
          </p>
        )}
      </div>
    </div>
  )
}
