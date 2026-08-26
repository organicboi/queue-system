'use server'

import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toSchoolTokenDTO,
  type SchoolTokenDTO, type SchoolActivityType, type DbSchoolToken,
} from '@/lib/db/school-types'

export interface SchoolTokenResult {
  token?: SchoolTokenDTO
  error?: string
}

// ── Token auth ────────────────────────────────────────────────
// A school counter authenticates with the token in its URL, exactly like the
// existing /counter/[token] terminals. Every mutation re-verifies it
// server-side; the client is never trusted for branch or counter identity.
interface VerifiedCounter {
  id: string
  customer_id: string
  branch_id: string
  name_en: string
  name_ar: string
  accepts_priority: boolean
  is_open: boolean
}

async function verifySchoolCounter(token: string): Promise<VerifiedCounter | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('school_counters')
    .select('id, customer_id, branch_id, name_en, name_ar, accepts_priority, is_open, is_active')
    .eq('counter_token', token)
    .maybeSingle()

  if (!data || !(data as { is_active: boolean }).is_active) return null
  return data as VerifiedCounter
}

// ── Display broadcast ─────────────────────────────────────────
// postgres_changes alone can't express "announce this again" — a recall
// changes no visible column — so calls also go out over a broadcast topic.
// Same mechanism as broadcastDisplaySignal in lib/actions/counters.ts.
export interface SchoolCallSignal {
  tokenCode: string
  counterEn: string
  counterAr: string
  departmentEn: string
  departmentAr: string
  isPriority: boolean
  recallCount: number
}

async function broadcastSchoolCall(
  branchId: string,
  event: 'token-called' | 'token-recalled',
  payload: SchoolCallSignal
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        messages: [{ topic: `school-display-${branchId}`, event, payload }],
      }),
    })
  } catch {
    /* Non-critical — the board still updates via postgres_changes. */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logSchoolActivity(supabase: any, row: {
  customerId: string
  branchId: string
  tokenId?: string | null
  counterId?: string | null
  departmentId?: string | null
  source?: string
  type: SchoolActivityType
  tokenCode: string
  message: string
}) {
  await supabase.from('school_activity_logs').insert({
    customer_id: row.customerId,
    branch_id: row.branchId,
    token_id: row.tokenId ?? null,
    counter_id: row.counterId ?? null,
    department_id: row.departmentId ?? null,
    source: row.source ?? 'staff',
    type: row.type,
    token_code: row.tokenCode,
    message: row.message,
  })
}

// Announce payload needs the department name, which the token row doesn't
// carry. One lookup, shared by every call/recall path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function departmentNames(supabase: any, departmentId: string) {
  const { data } = await supabase
    .from('school_departments')
    .select('name_en, name_ar')
    .eq('id', departmentId)
    .maybeSingle()
  return {
    en: (data as { name_en?: string } | null)?.name_en ?? '',
    ar: (data as { name_ar?: string } | null)?.name_ar ?? '',
  }
}

// ── Kiosk: issue a token ──────────────────────────────────────
// Authenticated by branch_token, like the rest of the device surfaces. The row
// is committed here, before the caller attempts to print — if the printer
// fails the visitor still has a number on screen.
export async function schoolIssueTokenAction(
  branchToken: string,
  departmentId: string,
  isPriority = false
): Promise<SchoolTokenResult> {
  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, is_active')
    .eq('branch_token', branchToken)
    .maybeSingle()

  if (!branch) return { error: 'Kiosk is not registered' }
  if (!(branch as { is_active: boolean }).is_active) return { error: 'This branch is not active' }

  const { data, error } = await supabase.rpc('claim_school_token', {
    p_branch_id: (branch as { id: string }).id,
    p_department_id: departmentId,
    p_source: 'kiosk',
    p_is_priority: isPriority,
  })

  if (error || !data) return { error: 'Could not issue a token. Please ask for assistance.' }
  return { token: toSchoolTokenDTO(data as DbSchoolToken) }
}

// ── NEXT ──────────────────────────────────────────────────────
export async function schoolCallNextAction(counterToken: string): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('call_next_school_token', {
    p_counter_id: counter.id,
  })

  if (error) return { error: 'Could not call the next token' }

  // A plpgsql function returning a composite type materialises `RETURN NULL`
  // as a row with every column null — NOT as JSON null. That object is truthy,
  // so a bare `!data` check passes an all-null token straight through: the
  // board then receives a broadcast with tokenCode null and the announcer
  // throws on it. Test the primary key, which is NOT NULL on a real row.
  const row = data as DbSchoolToken | null
  if (!row?.id) return { error: 'No one is waiting for this counter' }

  const token = toSchoolTokenDTO(row)
  const dept = await departmentNames(supabase, token.departmentId)

  await broadcastSchoolCall(counter.branch_id, 'token-called', {
    tokenCode: token.tokenCode,
    counterEn: counter.name_en,
    counterAr: counter.name_ar,
    departmentEn: dept.en,
    departmentAr: dept.ar,
    isPriority: token.isPriority,
    recallCount: token.recallCount,
  })

  return { token }
}

// ── Issue a token at the counter ──────────────────────────────
// A walk-in who never used the lobby kiosk — or a visitor who can't, which is
// most of the reason this exists: elderly and assisted visitors get handed a
// token at the window instead of being sent back to a touchscreen.
//
// The number is ALWAYS the next one in the department's series, never a number
// staff choose. school_tokens_code_uniq is (branch_id, service_date,
// token_code): minting F205 by hand while the cursor sits at 102 would collide
// the moment the kiosk's series reached 205, and the failure would land on a
// visitor at the kiosk hours later. Going through claim_school_token keeps the
// series gapless, the daily reset free and concurrent kiosks serialized.
//
// Any active department of the branch is allowed, not just the ones this
// counter serves: Reception issuing a Fees token is the flow schools ask for.
export async function schoolIssueAtCounterAction(
  counterToken: string,
  departmentId: string,
  isPriority = false
): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()

  // Re-checked server-side: the client is never trusted for which department
  // it may issue against, only for which one it picked.
  const { data: dept } = await supabase
    .from('school_departments')
    .select('id, name_en, is_active, branch_id')
    .eq('id', departmentId)
    .maybeSingle()

  const d = dept as { is_active: boolean; branch_id: string; name_en: string } | null
  if (!d || !d.is_active || d.branch_id !== counter.branch_id) {
    return { error: 'That department is not available at this branch' }
  }

  const { data, error } = await supabase.rpc('claim_school_token', {
    p_branch_id: counter.branch_id,
    p_department_id: departmentId,
    p_source: 'staff',
    p_is_priority: isPriority,
  })

  if (error) return { error: 'Could not issue a token' }

  // Same composite-null trap as call_next_school_token: a plpgsql function
  // returning a row type hands back an all-null row, not JSON null.
  const row = data as DbSchoolToken | null
  if (!row?.id) return { error: 'Could not issue a token' }

  return { token: toSchoolTokenDTO(row) }
}


// ── CALL (typed token code) ───────────────────────────────────
// The keypad path: staff type a token that is waiting, held or was a no-show
// and call it directly out of order.
export async function schoolCallCodeAction(
  counterToken: string,
  tokenCode: string
): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const code = tokenCode.trim().toUpperCase()
  if (!code) return { error: 'Enter a token number' }

  const supabase = createSupabaseServiceClient()
  const { data: serviceDate } = await supabase.rpc('school_service_date', {
    p_branch_id: counter.branch_id,
  })

  // Every token code carries a department prefix (F101), but the on-screen
  // keypad is digits-only — a letter is untypeable on a touchscreen terminal.
  // So bare digits are resolved against the departments THIS counter serves,
  // which is unambiguous for the normal single-department window. A USB
  // keyboard can still type the full code, and that path is matched exactly.
  let existing: unknown = null

  if (/^\d+$/.test(code)) {
    const { data: assigned } = await supabase
      .from('school_counter_departments')
      .select('department_id')
      .eq('counter_id', counter.id)

    const deptIds = ((assigned ?? []) as { department_id: string }[]).map((a) => a.department_id)
    if (deptIds.length === 0) return { error: 'This counter has no departments assigned yet' }

    const { data: matches } = await supabase
      .from('school_tokens')
      .select('*')
      .eq('branch_id', counter.branch_id)
      .eq('service_date', serviceDate as string)
      .eq('number', Number(code))
      .in('department_id', deptIds)

    const rows = (matches ?? []) as DbSchoolToken[]
    if (rows.length > 1) {
      // Two departments this counter serves both issued number 101.
      return {
        error: `${code} is ambiguous here — type the full code (${rows.map((r) => r.token_code).join(' or ')})`,
      }
    }
    existing = rows[0] ?? null
  } else {
    const { data } = await supabase
      .from('school_tokens')
      .select('*')
      .eq('branch_id', counter.branch_id)
      .eq('service_date', serviceDate as string)
      .eq('token_code', code)
      .maybeSingle()
    existing = data
  }

  if (!existing) return { error: `Token ${code} was not issued today` }

  const row = existing as DbSchoolToken
  if (row.status === 'served' || row.status === 'cancelled') {
    return { error: `Token ${code} is already ${row.status}` }
  }
  if (row.is_priority && !counter.accepts_priority) {
    return { error: `Token ${code} is a priority token and this counter does not take them` }
  }

  // The partial unique index allows one 'called' row per counter, so close the
  // current one out before promoting the new token.
  await supabase
    .from('school_tokens')
    .update({ status: 'served', served_at: new Date().toISOString() })
    .eq('counter_id', counter.id)
    .eq('status', 'called')

  const isRecall = row.counter_id === counter.id && row.status === 'called'
  const { data: updated, error } = await supabase
    .from('school_tokens')
    .update({
      status: 'called',
      counter_id: counter.id,
      called_at: new Date().toISOString(),
      call_count: row.call_count + 1,
      recall_count: isRecall ? row.recall_count + 1 : row.recall_count,
    })
    .eq('id', row.id)
    .select()
    .single()

  if (error || !updated) return { error: `Could not call token ${code}` }

  const token = toSchoolTokenDTO(updated as DbSchoolToken)
  const dept = await departmentNames(supabase, token.departmentId)

  await logSchoolActivity(supabase, {
    customerId: counter.customer_id,
    branchId: counter.branch_id,
    tokenId: token.id,
    counterId: counter.id,
    departmentId: token.departmentId,
    type: 'called',
    tokenCode: token.tokenCode,
    message: `${token.tokenCode} called to ${counter.name_en}`,
  })

  await broadcastSchoolCall(counter.branch_id, 'token-called', {
    tokenCode: token.tokenCode,
    counterEn: counter.name_en,
    counterAr: counter.name_ar,
    departmentEn: dept.en,
    departmentAr: dept.ar,
    isPriority: token.isPriority,
    recallCount: token.recallCount,
  })

  return { token }
}

// ── Current token helper ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function currentToken(supabase: any, counterId: string): Promise<DbSchoolToken | null> {
  const { data } = await supabase
    .from('school_tokens')
    .select('*')
    .eq('counter_id', counterId)
    .eq('status', 'called')
    .maybeSingle()
  return (data as DbSchoolToken | null) ?? null
}

// ── RECALL ────────────────────────────────────────────────────
// Re-announces the token already at this window. Changes no visible column
// other than recall_count, which is exactly why the broadcast exists.
export async function schoolRecallAction(counterToken: string): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, counter.id)
  if (!row) return { error: 'Nothing to recall' }

  const { data: updated } = await supabase
    .from('school_tokens')
    .update({
      recall_count: row.recall_count + 1,
      call_count: row.call_count + 1,
      called_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select()
    .single()

  const token = toSchoolTokenDTO((updated ?? row) as DbSchoolToken)
  const dept = await departmentNames(supabase, token.departmentId)

  await logSchoolActivity(supabase, {
    customerId: counter.customer_id,
    branchId: counter.branch_id,
    tokenId: token.id,
    counterId: counter.id,
    departmentId: token.departmentId,
    type: 'recalled',
    tokenCode: token.tokenCode,
    message: `${token.tokenCode} recalled (×${token.recallCount})`,
  })

  await broadcastSchoolCall(counter.branch_id, 'token-recalled', {
    tokenCode: token.tokenCode,
    counterEn: counter.name_en,
    counterAr: counter.name_ar,
    departmentEn: dept.en,
    departmentAr: dept.ar,
    isPriority: token.isPriority,
    recallCount: token.recallCount,
  })

  return { token }
}

// ── DONE / NO SHOW / HOLD ─────────────────────────────────────
async function closeCurrent(
  counterToken: string,
  status: 'served' | 'no-show' | 'held',
  type: SchoolActivityType,
  verb: string
): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, counter.id)
  if (!row) return { error: 'No token at this counter' }

  const { data: updated, error } = await supabase
    .from('school_tokens')
    .update({
      status,
      served_at: status === 'served' ? new Date().toISOString() : null,
      // A held token goes back into the pool unattached, so any window can
      // pick it up again; a no-show stays attributed to the counter that
      // called it, for the report.
      counter_id: status === 'held' ? null : counter.id,
    })
    .eq('id', row.id)
    .select()
    .single()

  if (error || !updated) return { error: `Could not mark ${row.token_code} ${verb}` }

  const token = toSchoolTokenDTO(updated as DbSchoolToken)
  await logSchoolActivity(supabase, {
    customerId: counter.customer_id,
    branchId: counter.branch_id,
    tokenId: token.id,
    counterId: counter.id,
    departmentId: token.departmentId,
    type,
    tokenCode: token.tokenCode,
    message: `${token.tokenCode} ${verb} at ${counter.name_en}`,
  })

  return { token }
}

export async function schoolDoneAction(counterToken: string) {
  return closeCurrent(counterToken, 'served', 'served', 'served')
}

export async function schoolNoShowAction(counterToken: string) {
  return closeCurrent(counterToken, 'no-show', 'no-show', 'a no-show')
}

export async function schoolHoldAction(counterToken: string) {
  return closeCurrent(counterToken, 'held', 'held', 'held')
}

// ── TRANSFER ──────────────────────────────────────────────────
// Reception → Fees is the most common school flow. The visitor keeps their
// original token code and goes back into the target department's waiting pool.
export async function schoolTransferAction(
  counterToken: string,
  targetDepartmentId: string
): Promise<SchoolTokenResult> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, counter.id)
  if (!row) return { error: 'No token at this counter' }
  if (row.department_id === targetDepartmentId) return { error: 'Already in that department' }

  const { data: dept } = await supabase
    .from('school_departments')
    .select('id, name_en')
    .eq('id', targetDepartmentId)
    .eq('branch_id', counter.branch_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!dept) return { error: 'Department not found' }

  const { data: updated, error } = await supabase
    .from('school_tokens')
    .update({
      department_id: targetDepartmentId,
      transferred_from_department_id: row.department_id,
      status: 'waiting',
      counter_id: null,
      called_at: null,
      joined_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select()
    .single()

  if (error || !updated) return { error: `Could not transfer ${row.token_code}` }

  const token = toSchoolTokenDTO(updated as DbSchoolToken)
  await logSchoolActivity(supabase, {
    customerId: counter.customer_id,
    branchId: counter.branch_id,
    tokenId: token.id,
    counterId: counter.id,
    departmentId: targetDepartmentId,
    type: 'transferred',
    tokenCode: token.tokenCode,
    message: `${token.tokenCode} transferred to ${(dept as { name_en: string }).name_en}`,
  })

  return { token }
}

// ── Counter presence & shift toggle ───────────────────────────
export async function schoolCounterHeartbeatAction(counterToken: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  await supabase
    .from('school_counters')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('counter_token', counterToken)
}

export async function schoolToggleCounterOpenAction(
  counterToken: string
): Promise<{ isOpen?: boolean; error?: string }> {
  const counter = await verifySchoolCounter(counterToken)
  if (!counter) return { error: 'Counter not found' }

  const supabase = createSupabaseServiceClient()
  const next = !counter.is_open
  const { error } = await supabase
    .from('school_counters')
    .update({ is_open: next, updated_at: new Date().toISOString() })
    .eq('id', counter.id)

  if (error) return { error: 'Could not update the counter' }

  await logSchoolActivity(supabase, {
    customerId: counter.customer_id,
    branchId: counter.branch_id,
    counterId: counter.id,
    type: next ? 'counter-opened' : 'counter-closed',
    tokenCode: '',
    message: `${counter.name_en} ${next ? 'opened' : 'closed'}`,
  })

  return { isOpen: next }
}
