import type { NextRequest } from 'next/server'
import { getHospitalBoard } from '@/lib/dal/hospital'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/hospital-display/[screenToken]
//
// Native-app equivalent of /hospital/display/[screenToken]
// (components/hospital/HospitalBoard.tsx). Thin wrapper over the same
// get_hospital_board RPC the web page's action calls — no new DB access. The
// RPC bumps screens.last_seen_at on every call, so polling this gives device
// presence for free. Token codes + room/doctor labels only; never joins
// hospital_patients.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ screenToken: string }> }
) {
  const { screenToken } = await params
  const packet = await getHospitalBoard(screenToken)

  if (packet.status === 'not-found') {
    return json({ error: 'Display is not registered' }, 404)
  }
  if (packet.status === 'expired') {
    return json({ error: 'Display token has expired' }, 404)
  }

  return json(packet)
}
