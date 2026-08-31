import type { NextRequest } from 'next/server'
import { redeemPairingCode } from '@/lib/dal/device-pairing'
import { json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/pair   { code: "482017" }
//
// The device-side half of the pairing flow: swap a dashboard-minted 6-digit
// code for the branch/screen's real long token. The code is single-use and
// expires in minutes; from here on the device authenticates with the token
// like it always has (see app/api/kiosk/… and app/api/display/…).
//
// A blind guess targets a 6-digit space (10^6) against, at any moment, only a
// handful of live codes — but that is still worth a crude per-instance IP
// throttle. It is best-effort (serverless instances don't share the map); the
// real backstop is the tiny live-code ratio times the short TTL.
const WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS_PER_IP = 12
const attempts = new Map<string, number[]>()

function throttled(ip: string): boolean {
  const now = Date.now()
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  attempts.set(ip, recent)
  if (attempts.size > 5000) {
    // Bound the map — drop anything with no hits in the window.
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= WINDOW_MS)) attempts.delete(key)
    }
  }
  return recent.length > MAX_ATTEMPTS_PER_IP
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (throttled(ip)) {
    return json({ error: 'Too many attempts. Wait a few minutes, then try again.' }, 429)
  }

  const body = await readJsonBody<{ code?: string }>(request)
  const code = (body?.code ?? '').trim()
  if (!/^\d{6}$/.test(code)) {
    return json({ error: 'Enter the 6-digit code shown on the dashboard.' }, 400)
  }

  const result = await redeemPairingCode(code, ip)
  switch (result.status) {
    case 'ok':
      return json({
        v: 1,
        baseUrl: new URL(request.url).origin,
        role: result.role,
        token: result.token,
        name: result.name ?? '',
      })
    case 'expired':
      return json({ error: 'That code has expired. Generate a new one on the dashboard.' }, 410)
    default:
      return json({ error: "That code isn't valid. Check the dashboard and try again." }, 404)
  }
}
