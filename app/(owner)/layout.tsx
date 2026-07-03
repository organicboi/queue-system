import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  if (!profile) redirect('/onboard')

  return (
    <div className="h-screen overflow-y-auto bg-slate-50">
      {children}
    </div>
  )
}
