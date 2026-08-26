import { redirect } from 'next/navigation'
import { getSession, getProfile } from '@/lib/dal/session'

export default async function HomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await getProfile()
  redirect(profile?.vertical === 'school' ? '/school/dashboard' : '/dashboard')
}
