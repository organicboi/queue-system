import type { NextRequest } from 'next/server'
import { schoolIssueTokenAction } from '@/lib/actions/school-tokens'
import { errorStatus, json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/kiosk/[branchToken]/tokens
// Body: { departmentId: string, isPriority?: boolean, locale?: string }
// Issues a token via claim_school_token (wrapped by schoolIssueTokenAction).
// The row is committed here before the app prints — a printer failure never
// loses the ticket number.
//
// `waitingAhead` rides along because the app prints it on the ticket, and it
// has to be the count as of the moment the number was minted — the 6s feed
// poll is both stale and per-department, not per-token.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const body = await readJsonBody<{
    departmentId?: unknown
    isPriority?: unknown
    locale?: unknown
  }>(request)

  if (!body || typeof body.departmentId !== 'string' || !body.departmentId) {
    return json({ error: 'departmentId is required' }, 400)
  }

  const result = await schoolIssueTokenAction(
    branchToken,
    body.departmentId,
    body.isPriority === true,
    typeof body.locale === 'string' ? body.locale : undefined
  )

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token, waitingAhead: result.waitingAhead })
}
