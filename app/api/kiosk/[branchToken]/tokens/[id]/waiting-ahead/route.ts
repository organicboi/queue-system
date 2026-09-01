import type { NextRequest } from 'next/server'
import { schoolKioskWaitingAheadAction } from '@/lib/actions/school-tokens'
import { errorStatus, json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// GET /api/kiosk/[branchToken]/tokens/[id]/waiting-ahead
// How many visitors are still ahead of this token right now. Read fresh for a
// reprint from the recent rail: the count printed on the original ticket was
// true when it was issued and is not true minutes later.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchToken: string; id: string }> }
) {
  const { branchToken, id } = await params
  const result = await schoolKioskWaitingAheadAction(branchToken, id)

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ waitingAhead: result.waitingAhead })
}
