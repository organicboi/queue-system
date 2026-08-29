import type { NextRequest } from 'next/server'
import { schoolKioskSetPriorityAction } from '@/lib/actions/school-tokens'
import { errorStatus, json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'

// POST /api/kiosk/[branchToken]/tokens/[id]/priority
// Body: { isPriority: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchToken: string; id: string }> }
) {
  const { branchToken, id } = await params
  const body = await readJsonBody<{ isPriority?: unknown }>(request)

  if (!body || typeof body.isPriority !== 'boolean') {
    return json({ error: 'isPriority (boolean) is required' }, 400)
  }

  const result = await schoolKioskSetPriorityAction(branchToken, id, body.isPriority)

  if (result.error) return json({ error: result.error }, errorStatus(result.error))
  return json({ token: result.token })
}
