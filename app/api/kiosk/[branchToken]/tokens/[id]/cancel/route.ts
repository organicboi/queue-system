import type { NextRequest } from 'next/server'
import { schoolKioskCancelTokenAction } from '@/lib/actions/school-tokens'
import { errorStatus, json } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/kiosk/[branchToken]/tokens/[id]/cancel
// Only valid for waiting/held tokens — the action enforces this and its error
// string is surfaced as-is (409 when the token is already at a counter).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ branchToken: string; id: string }> }
) {
  const { branchToken, id } = await params
  const result = await schoolKioskCancelTokenAction(branchToken, id)

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token })
}
