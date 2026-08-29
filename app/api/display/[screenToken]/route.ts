import type { NextRequest } from 'next/server'
import { getSchoolBoard } from '@/lib/dal/school'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/display/[screenToken]
//
// Native-app equivalent of the web waiting-area board at
// /school/display/[screenToken] (components/school/SchoolBoard.tsx). Thin
// wrapper over the same `get_school_board` RPC the web page's server action
// calls (lib/actions/school-read.ts#fetchSchoolBoardAction) — no new DB
// access, no schema change. The RPC also bumps `screens.last_seen_at` on
// every call, so polling this route gives device presence for free.
//
// Auth model matches the kiosk routes: the opaque `screen_token` is the only
// credential, carried in the path and re-verified server-side by the RPC —
// never trust a client-supplied screen/branch id.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ screenToken: string }> }
) {
  const { screenToken } = await params
  const packet = await getSchoolBoard(screenToken)

  if (packet.status === 'not-found') {
    return json({ error: 'Display is not registered' }, 404)
  }
  if (packet.status === 'expired') {
    return json({ error: 'Display token has expired' }, 404)
  }

  return json(packet)
}
