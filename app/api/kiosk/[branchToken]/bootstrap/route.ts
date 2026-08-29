import type { NextRequest } from 'next/server'
import { getSchoolKioskPacket } from '@/lib/dal/school'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/kiosk/[branchToken]/bootstrap
// Everything the app needs to boot: branch name, active departments, school
// settings (names EN/AR, logo, ticket footer, print_enabled, languages), plus
// silentPrint/printerName for parity with the web kiosk (the app manages its
// own printer connection and can ignore them).
export async function GET(
  _request: NextRequest,
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

  return json(packet)
}
