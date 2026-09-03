import type { NextRequest } from 'next/server'
import { fetchHospitalKioskFeedAction } from '@/lib/actions/hospital-read'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/hospital-kiosk/[branchToken]/feed
// Per-department queue depth + today's count. The app polls this every 8s to
// match FEED_POLL_MS in components/hospital/HospitalKiosk.tsx.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const feed = await fetchHospitalKioskFeedAction(branchToken)

  if (feed.status === 'not-found') {
    return json({ error: 'Kiosk is not registered' }, 404)
  }

  return json(feed)
}
