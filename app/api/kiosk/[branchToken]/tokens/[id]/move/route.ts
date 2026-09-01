import type { NextRequest } from 'next/server'
import { schoolKioskMoveTokenAction } from '@/lib/actions/school-tokens'
import { errorStatus, json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/kiosk/[branchToken]/tokens/[id]/move
// Body: { departmentId: string }
// Keeps the printed token code; re-queues it in the target department.
// `waitingAhead` is the target department's queue, for a ticket reprinted
// after the move.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string; id: string }> }
) {
  const { branchToken, id } = await params
  const body = await readJsonBody<{ departmentId?: unknown }>(request)

  if (!body || typeof body.departmentId !== 'string' || !body.departmentId) {
    return json({ error: 'departmentId is required' }, 400)
  }

  const result = await schoolKioskMoveTokenAction(branchToken, id, body.departmentId)

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token, waitingAhead: result.waitingAhead })
}
