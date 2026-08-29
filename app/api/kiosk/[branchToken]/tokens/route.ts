import type { NextRequest } from 'next/server'
import { schoolIssueTokenAction } from '@/lib/actions/school-tokens'
import { errorStatus, json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/kiosk/[branchToken]/tokens
// Body: { departmentId: string, isPriority?: boolean }
// Issues a token via claim_school_token (wrapped by schoolIssueTokenAction).
// The row is committed here before the app prints — a printer failure never
// loses the ticket number.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const body = await readJsonBody<{ departmentId?: unknown; isPriority?: unknown }>(request)

  if (!body || typeof body.departmentId !== 'string' || !body.departmentId) {
    return json({ error: 'departmentId is required' }, 400)
  }

  const result = await schoolIssueTokenAction(
    branchToken,
    body.departmentId,
    body.isPriority === true
  )

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token })
}
