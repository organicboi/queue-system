import { redirect } from 'next/navigation'
import { getUser, getProfile } from '@/lib/dal/session'

export default async function HomePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()
  redirect(profile?.vertical === 'school' ? '/school/dashboard' : '/dashboard')
}
