import 'server-only'
import { createSupabaseServiceClient } from '@/lib/db/server'

// Short-lived 6-digit codes that a device swaps once for its real long token.
// See supabase/migrations/20260901_device_pairing_codes.sql for the why.

const CODE_TTL_MINUTES = 10
const GENERATE_RETRIES = 8

export interface PairingCode {
  code: string
  expiresAt: string
}

export interface CreatePairingCodeInput {
  customerId: string
  branchId: string
  role: 'kiosk' | 'display'
  screenId?: string | null
  createdBy?: string | null
}

function sixDigits(): string {
  // 100000–999999, never a leading zero so it always reads as 6 digits.
  return String(100000 + Math.floor(Math.random() * 900000))
}

/**
 * Mint a code for one target (a branch's kiosk, or one display screen). Any
 * still-live code for the same target is dropped first so the operator is only
 * ever looking at one number.
 */
export async function createPairingCode(input: CreatePairingCodeInput): Promise<PairingCode> {
  const supabase = createSupabaseServiceClient()
  const nowIso = new Date().toISOString()

  // Keep the table (and the 6-digit keyspace) clear of dead rows.
  await supabase.from('device_pairing_codes').delete().lt('expires_at', nowIso)

  const prior = supabase
    .from('device_pairing_codes')
    .delete()
    .is('consumed_at', null)
    .eq('branch_id', input.branchId)
    .eq('role', input.role)
  if (input.role === 'display' && input.screenId) prior.eq('screen_id', input.screenId)
  else prior.is('screen_id', null)
  await prior

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  for (let attempt = 0; attempt < GENERATE_RETRIES; attempt++) {
    const code = sixDigits()
    const { error } = await supabase.from('device_pairing_codes').insert({
      code,
      customer_id: input.customerId,
      branch_id: input.branchId,
      role: input.role,
      screen_id: input.role === 'display' ? input.screenId ?? null : null,
      created_by: input.createdBy ?? null,
      expires_at: expiresAt,
    })
    if (!error) return { code, expiresAt }
    // 23505 = the code collided with another target's live code — try again.
    if (error.code !== '23505') throw new Error('Could not create a pairing code')
  }
  throw new Error('Could not allocate a pairing code — try again')
}

export interface RedeemResult {
  status: 'ok' | 'not-found' | 'expired'
  role?: 'kiosk' | 'display'
  token?: string
  name?: string
}

/**
 * Exchange a code for the target's real token. Single use: the row is claimed
 * atomically so two devices racing the same code can't both win.
 */
export async function redeemPairingCode(rawCode: string, ip?: string): Promise<RedeemResult> {
  const code = (rawCode ?? '').replace(/\D/g, '')
  if (code.length !== 6) return { status: 'not-found' }

  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('device_pairing_codes')
    .select('id, branch_id, screen_id, role, expires_at')
    .eq('code', code)
    .is('consumed_at', null)
    .maybeSingle()

  if (!data) return { status: 'not-found' }
  const row = data as {
    id: string
    branch_id: string
    screen_id: string | null
    role: 'kiosk' | 'display'
    expires_at: string
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('device_pairing_codes').delete().eq('id', row.id)
    return { status: 'expired' }
  }

  const { data: claimed } = await supabase
    .from('device_pairing_codes')
    .update({ consumed_at: new Date().toISOString(), consumed_ip: ip ?? null })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return { status: 'not-found' }

  if (row.role === 'kiosk') {
    const { data: branch } = await supabase
      .from('branches')
      .select('branch_token, name, is_active')
      .eq('id', row.branch_id)
      .maybeSingle()
    const b = branch as { branch_token: string; name: string; is_active: boolean } | null
    if (!b || !b.is_active) return { status: 'not-found' }
    return { status: 'ok', role: 'kiosk', token: b.branch_token, name: b.name }
  }

  if (!row.screen_id) return { status: 'not-found' }
  const { data: screen } = await supabase
    .from('screens')
    .select('screen_token, name, is_active')
    .eq('id', row.screen_id)
    .maybeSingle()
  const s = screen as { screen_token: string; name: string; is_active: boolean } | null
  if (!s || !s.is_active) return { status: 'not-found' }
  return { status: 'ok', role: 'display', token: s.screen_token, name: s.name }
}
