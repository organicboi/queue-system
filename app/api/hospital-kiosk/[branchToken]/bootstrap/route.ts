import type { NextRequest } from 'next/server'
import { getHospitalKioskAppPacket } from '@/lib/dal/hospital'
import { publicTrackingBaseUrl } from '@/lib/hospital/constants'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/hospital-kiosk/[branchToken]/bootstrap
//
// Native-app equivalent of app/(hospital)/hospital/(device)/kiosk/[branchToken]/page.tsx:
// branch name, hospital settings (name/logo/footer/languages/print flags),
// kiosk departments (opd + triage), the doctors on duty today (schedule − leave,
// resolved server-side), and the effective public-tracking gate. Names only —
// no patient data crosses here.
//
// publicBaseUrl rides along because the app has no window.location to build a
// QR URL from, and its API host can be a LAN address a visitor's phone can't
// reach (mirrors the school kiosk bootstrap route).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const packet = await getHospitalKioskAppPacket(branchToken)

  if (packet.status === 'not-found') {
    return json({ error: 'Kiosk is not registered' }, 404)
  }
  if (packet.status === 'inactive') {
    return json({ error: 'This branch is not active' }, 404)
  }

  return json({ ...packet, publicBaseUrl: publicTrackingBaseUrl(request.nextUrl.origin) })
}
