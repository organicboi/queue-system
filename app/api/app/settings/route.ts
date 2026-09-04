import type { NextRequest } from 'next/server'
import { authenticateAppRequest, assertBranchOwned } from '@/lib/api/app-auth'
import { readTenantSettings } from '@/lib/dal/app-settings'
import { saveSchoolSettingsAction } from '@/lib/actions/school-admin'
import { saveHospitalSettingsAction } from '@/lib/actions/hospital-admin'
import { json, readJsonBody } from '@/lib/api/kiosk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET|PATCH /api/app/settings?branchId=<uuid>   (Authorization: Bearer …)
//
// The tenant-settings section of the app's Settings screen. GET returns the
// current school/hospital settings row + the deployment's locale menu; PATCH
// takes a partial patch and echoes the saved DTO. Both verify the Bearer token
// and that the operator manages this branch. Writes reuse the web server
// actions with the already-resolved profile so the cookie guard is skipped.

async function resolve(request: NextRequest) {
  const auth = await authenticateAppRequest(request)
  if (!auth.ok) return { error: auth.response }

  const branchId = request.nextUrl.searchParams.get('branchId')?.trim() ?? ''
  if (!branchId) return { error: json({ error: 'Missing branchId.' }, 400) }

  if (!(await assertBranchOwned(auth.ctx.profile, branchId))) {
    return { error: json({ error: 'You do not have access to this branch.' }, 403) }
  }
  return { profile: auth.ctx.profile, branchId }
}

export async function GET(request: NextRequest) {
  const r = await resolve(request)
  if ('error' in r) return r.error

  const payload = await readTenantSettings(r.profile.vertical ?? 'business', r.branchId)
  return json(payload)
}

export async function PATCH(request: NextRequest) {
  const r = await resolve(request)
  if ('error' in r) return r.error

  const body = (await readJsonBody<Record<string, unknown>>(request)) ?? {}
  const vertical = r.profile.vertical ?? 'business'

  if (vertical === 'school') {
    const input = { ...body, branchId: r.branchId } as Parameters<typeof saveSchoolSettingsAction>[0]
    const result = await saveSchoolSettingsAction(input, r.profile)
    if (result.error) return json({ error: result.error }, 400)
    return json({ vertical, settings: result.settings })
  }
  if (vertical === 'hospital') {
    const input = { ...body, branchId: r.branchId } as Parameters<typeof saveHospitalSettingsAction>[0]
    const result = await saveHospitalSettingsAction(input, r.profile)
    if (result.error) return json({ error: result.error }, 400)
    return json({ vertical, settings: result.settings })
  }
  return json({ error: 'This product has no editable settings here.' }, 400)
}
