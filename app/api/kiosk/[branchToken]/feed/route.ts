import type { NextRequest } from 'next/server'
import { fetchSchoolKioskFeedAction } from '@/lib/actions/school-read'
import { json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/kiosk/[branchToken]/feed
// The recent-ticket rail + per-department queue depth. The app polls this
// every 6s (FEED_POLL_MS in components/school/SchoolKiosk.tsx) so kiosk and
// app behave identically.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const feed = await fetchSchoolKioskFeedAction(branchToken)

  if (feed.status === 'not-found') {
    return json({ error: 'Kiosk is not registered' }, 404)
  }

  return json(feed)
}
