import { redirect } from 'next/navigation'
import { getUser, getProfile } from '@/lib/dal/session'
import { verticalHome } from '@/lib/verticals'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')
  // The owner roll-up reads queue_entries and activity_logs — school and
  // hospital tenants have rows in neither, so it would render an empty dashboard.
  if (profile.vertical === 'school' || profile.vertical === 'hospital') {
    redirect(verticalHome(profile.vertical, profile.role))
  }

  return (
    <div className="h-screen overflow-y-auto bg-slate-50">
      {children}
    </div>
  )
}
