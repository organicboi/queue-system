import type { NextRequest } from 'next/server'
import { hospitalIssueTokenAction } from '@/lib/actions/hospital-tokens'
import { errorStatus, json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/hospital-kiosk/[branchToken]/tokens
// Body: { departmentId: string, doctorId?: string | null,
//         priorityCategory?: string | null, locale?: string }
//
// Issues a walk-in token via claim_hospital_token (wrapped by
// hospitalIssueTokenAction). The row commits here before the app prints — a
// printer failure never loses the number. `waitingAhead` rides along for the
// ticket line, counted as of the moment the number was minted.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string }> }
) {
  const { branchToken } = await params
  const body = await readJsonBody<{
    departmentId?: unknown
    doctorId?: unknown
    priorityCategory?: unknown
    locale?: unknown
  }>(request)

  if (!body || typeof body.departmentId !== 'string' || !body.departmentId) {
    return json({ error: 'departmentId is required' }, 400)
  }

  const result = await hospitalIssueTokenAction(
    branchToken,
    body.departmentId,
    typeof body.doctorId === 'string' && body.doctorId ? body.doctorId : null,
    typeof body.priorityCategory === 'string' && body.priorityCategory
      ? body.priorityCategory
      : null,
    typeof body.locale === 'string' ? body.locale : undefined
  )

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token, waitingAhead: result.waitingAhead })
}
