import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createSupabaseAppClient } from '@/lib/db/server'
import { getProfileById } from '@/lib/dal/session'
import { getAccessibleBranches } from '@/lib/dal/users'
import type { ProfileDTO } from '@/lib/db/types'
import { json } from '@/lib/api/kiosk'

// Bearer-token auth for the native-app routes (`app/api/app/*`). The device
// holds a Supabase session (access + refresh tokens) it got from
// `POST /api/app/login`; every subsequent call sends the access token as
// `Authorization: Bearer …`. We verify it against the Auth server, load the
// profile the same way `getProfile` does (service client, to get past the
// recursive RLS on profiles → customers), and hand the route a resolved
// `{ user, profile }`. 401 / 403 bodies use the same `json()` shape as the
// kiosk routes so the app branches on status, not on message text.

export interface AppAuthContext {
  user: User
  profile: ProfileDTO
}

type AppAuthResult =
  | { ok: true; ctx: AppAuthContext }
  | { ok: false; response: Response }

export async function authenticateAppRequest(request: Request): Promise<AppAuthResult> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : ''
  if (!token) {
    return { ok: false, response: json({ error: 'Not signed in.' }, 401) }
  }

  const supabase = createSupabaseAppClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, response: json({ error: 'Session expired. Sign in again.' }, 401) }
  }

  const profile = await getProfileById(data.user.id)
  if (!profile || !profile.isActive) {
    return { ok: false, response: json({ error: 'This account cannot manage devices.' }, 403) }
  }

  return { ok: true, ctx: { user: data.user, profile } }
}

// Mirrors `requireBranchManager` without the throw: an admin manages any branch
// of their customer; a branch_user only the branch(es) they are assigned to.
export async function assertBranchOwned(profile: ProfileDTO, branchId: string): Promise<boolean> {
  const branches = await getAccessibleBranches(profile)
  return branches.some((b) => b.id === branchId)
}
