import type { NextRequest } from 'next/server'
import { getPublicTicketStatus } from '@/lib/dal/school'
import { getHospitalPublicTicketStatus } from '@/lib/dal/hospital'

export const dynamic = 'force-dynamic'

// GET /api/public/ticket/[code]
// The QR on a printed ticket points at /t/[code] (app/(public)/t/[code]),
// which polls this. `code` is the opaque school_tokens.public_code — never
// the row id — so an unknown, wrong-day, or disabled-tenant code all answer
// with the same shape and a reason discriminator, never a 500 or a stack.
//
// Deliberately reached only through this route on the service-role client
// (same pattern as every other device surface here — see
// app/api/display/[screenToken]/route.ts) rather than exposing the RPC to the
// anon/publishable key: it keeps this feature's traffic funnelled through our
// own error handling and caching instead of open to unlimited direct calls.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  // Same opaque 8-char code space for both verticals; a school deployment has
  // no hospital tokens and vice versa. Try school, then fall back to the
  // hospital tracker (normalised into the same shape) on an unknown code.
  let result = await getPublicTicketStatus(code)
  if (result.status === 'not-found') {
    const hospital = await getHospitalPublicTicketStatus(code)
    if (hospital) result = hospital
  }

  return Response.json(result, {
    status: 200,
    headers: {
      // Short and mostly to absorb double-mounts/retries from the same
      // visitor — the real traffic control is the client's adaptive polling
      // interval (app/(public)/t/[code]/TrackerClient.tsx), not this cache.
      'Cache-Control': 'public, s-maxage=4, stale-while-revalidate=20',
    },
  })
}
