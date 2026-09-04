import type { NextRequest } from 'next/server'
import { createSupabaseAppClient } from '@/lib/db/server'
import { json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/app/refresh   { refreshToken }
//
// Swap a refresh token for a fresh session. Supabase rotates the refresh token,
// so the device must store the one returned here. A failure (revoked / expired
// token) is a 401 — the app then drops the session and asks the operator to
// sign in again; the device keeps running on its long branch/screen token
// meanwhile.
export async function POST(request: NextRequest) {
  const body = await readJsonBody<{ refreshToken?: string }>(request)
  const refreshToken = (body?.refreshToken ?? '').trim()
  if (!refreshToken) {
    return json({ error: 'Missing refresh token.' }, 400)
  }

  const supabase = createSupabaseAppClient()
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) {
    return json({ error: 'Session expired. Sign in again.' }, 401)
  }

  return json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
    },
  })
}
