import type { NextRequest } from 'next/server'
import { getSchoolKioskPacket } from '@/lib/dal/school'
import { json } from '@/lib/api/kiosk'
import { publicTrackingBaseUrl } from '@/lib/school/constants'

export const dynamic = 'force-dynamic'

// GET /api/kiosk/[branchToken]/bootstrap
// Everything the app needs to boot: branch name, active departments, school
// settings (names EN/AR, logo, ticket footer, print_enabled, languages), plus
// silentPrint/printerName for parity with the web kiosk (the app manages its
// own printer connection and can ignore them).
//
// publicBaseUrl rides along too: the app has no window.location of its own to
// build a QR URL from, and its configured API host can be a LAN/internal
// address a visitor's own phone can't reach — see
// lib/school/constants.ts#publicTrackingBaseUrl.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const packet = await getSchoolKioskPacket(branchToken)

  if (packet.status === 'not-found') {
    return json({ error: 'Kiosk is not registered' }, 404)
  }
  if (packet.status === 'inactive') {
    return json({ error: 'This branch is not active' }, 404)
  }

  return json({ ...packet, publicBaseUrl: publicTrackingBaseUrl(request.nextUrl.origin) })
}
