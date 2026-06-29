'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireProfile } from '@/lib/dal/session'
import { toQueueEntryDTO, type QueueEntryDTO, type DbQueueEntry, type DbQueueState } from '@/lib/db/types'

export interface QueueActionResult {
  error?: string
  entry?: QueueEntryDTO
}

async function broadcastDisplaySignal(
  branchId: string,
  event: 'customer-called' | 'customer-recalled',
  payload: { queueNumber: number; billNumber: string; callCount: number }
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'apikey': key,
      },
      body: JSON.stringify({
        messages: [{ topic: `queue-display-signals-${branchId}`, event, payload }],
      }),
    })
  } catch {
    // Non-critical — display still updates via postgres_changes
  }
}

async function logActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customerId: string,
  branchId: string,
  type: string,
  entryId: string | null,
  queueNumber: number,
  billNumber: string,
  message: string,
  performedBy: string | null = null,
  source: string = 'admin'
) {
  await supabase.from('activity_logs').insert({
    customer_id: customerId,
    branch_id: branchId,
    entry_id: entryId,
    performed_by: performedBy,
    source,
    type,
    queue_number: queueNumber,
    bill_number: billNumber,
    message,
  })
}

async function verifyBranchAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  branchId: string,
  customerId: string
): Promise<{ customerId: string } | null> {
  const { data } = await supabase
    .from('branches')
    .select('customer_id')
    .eq('id', branchId)
    .eq('customer_id', customerId)
    .single()
  return data
}

// ── Add entry (admin/kiosk) ───────────────────────────────────
const AddEntrySchema = z.object({
  billNumber: z.string().min(1, 'Bill number is required').max(50),
  branchId: z.string().uuid('Invalid branch'),
  customerName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
})

export async function addEntryAction(
  _prev: QueueActionResult,
  formData: FormData
): Promise<QueueActionResult> {
  const profile = await requireProfile()
  const parsed = AddEntrySchema.safeParse({
    billNumber: formData.get('billNumber'),
    branchId: formData.get('branchId'),
    customerName: formData.get('customerName') || undefined,
    phone: formData.get('phone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()
  const branch = await verifyBranchAccess(supabase, parsed.data.branchId, profile.customerId)
  if (!branch) return { error: 'Branch not found or access denied' }

  const { data: numData, error: numErr } = await supabase.rpc('claim_queue_number', {
    p_branch_id: parsed.data.branchId,
  })
  if (numErr || numData == null) return { error: 'Failed to assign queue number' }

  const queueNumber = numData as number
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      queue_number: queueNumber,
      bill_number: parsed.data.billNumber,
      customer_name: parsed.data.customerName ?? '',
      phone: parsed.data.phone ?? '',
      status: 'waiting',
      source: 'admin',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create entry' }

  const entry = toQueueEntryDTO(data as DbQueueEntry)
  await logActivity(supabase, profile.customerId, parsed.data.branchId, 'joined',
    entry.id, queueNumber, parsed.data.billNumber,
    `Queue #${queueNumber} joined — Bill ${parsed.data.billNumber}`,
    profile.id)

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${parsed.data.branchId}`)
  return { entry }
}

// ── Public self-join ──────────────────────────────────────────
const PublicJoinSchema = z.object({
  billNumber: z.string().min(1).max(50),
  branchId: z.string().uuid(),
  customerName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
})

export async function publicJoinAction(
  _prev: QueueActionResult,
  formData: FormData
): Promise<QueueActionResult> {
  const parsed = PublicJoinSchema.safeParse({
    billNumber: formData.get('billNumber'),
    branchId: formData.get('branchId'),
    customerName: formData.get('customerName') || undefined,
    phone: formData.get('phone') || undefined,
  })
  if (!parsed.success) return { error: 'Please enter a valid bill number' }

  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, customer_id, allow_self_join, max_capacity')
    .eq('id', parsed.data.branchId)
    .eq('is_active', true)
    .single()

  if (!branch) return { error: 'Queue not found' }
  if (!branch.allow_self_join) return { error: 'Self-join is currently disabled' }

  const { count } = await supabase
    .from('queue_entries')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', parsed.data.branchId)
    .in('status', ['waiting', 'in-progress'])

  if ((count ?? 0) >= (branch.max_capacity ?? 100)) {
    return { error: 'Queue is currently full. Please try again later.' }
  }

  const { data: numData, error: numErr } = await supabase.rpc('claim_queue_number', {
    p_branch_id: parsed.data.branchId,
  })
  if (numErr || numData == null) return { error: 'Failed to assign queue number' }

  const queueNumber = numData as number
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({
      customer_id: branch.customer_id,
      branch_id: parsed.data.branchId,
      queue_number: queueNumber,
      bill_number: parsed.data.billNumber,
      customer_name: parsed.data.customerName ?? '',
      phone: parsed.data.phone ?? '',
      status: 'waiting',
      source: 'self-join',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to join queue' }

  return { entry: toQueueEntryDTO(data as DbQueueEntry) }
}

// ── Kiosk add entry (branch token auth) ──────────────────────
export async function kioskAddEntryAction(
  branchToken: string,
  billNumber: string,
  customerName = '',
  phone = ''
): Promise<QueueActionResult> {
  if (!billNumber.trim()) return { error: 'Bill number is required' }

  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, customer_id, allow_self_join, max_capacity, is_active')
    .eq('branch_token', branchToken)
    .single()

  if (!branch || !branch.is_active) return { error: 'Branch not found' }

  const { data: numData, error: numErr } = await supabase.rpc('claim_queue_number', {
    p_branch_id: branch.id,
  })
  if (numErr || numData == null) return { error: 'Failed to assign queue number' }

  const queueNumber = numData as number
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({
      customer_id: branch.customer_id,
      branch_id: branch.id,
      queue_number: queueNumber,
      bill_number: billNumber.trim(),
      customer_name: customerName,
      phone,
      status: 'waiting',
      source: 'kiosk',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create entry' }

  await logActivity(supabase, branch.customer_id, branch.id, 'joined',
    data.id, queueNumber, billNumber.trim(),
    `Queue #${queueNumber} joined — Bill ${billNumber} (kiosk)`,
    null, 'kiosk')

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branch.id}`)
  return { entry: toQueueEntryDTO(data as DbQueueEntry) }
}

// ── Call next ─────────────────────────────────────────────────
export async function callNextAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Branch not found or access denied' }

  const now = new Date().toISOString()

  const { data: stateRow } = await supabase
    .from('queue_state')
    .select('current_serving_number')
    .eq('branch_id', branchId)
    .single()

  const currentNumber = (stateRow as DbQueueState | null)?.current_serving_number ?? 0

  // Complete current in-progress entry
  if (currentNumber > 0) {
    const { data: cur } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('branch_id', branchId)
      .eq('queue_number', currentNumber)
      .eq('status', 'in-progress')
      .single()

    if (cur) {
      await supabase.from('queue_entries')
        .update({ status: 'completed', completed_at: now })
        .eq('id', cur.id)
      await logActivity(supabase, profile.customerId, branchId, 'completed',
        cur.id, cur.queue_number, cur.bill_number,
        `Queue #${cur.queue_number} completed`, profile.id)
    }
  }

  // Find next waiting entry
  const { data: nextRow } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('branch_id', branchId)
    .eq('status', 'waiting')
    .order('queue_number', { ascending: true })
    .limit(1)
    .single()

  if (!nextRow) {
    revalidatePath('/dashboard')
    revalidatePath(`/branches/${branchId}`)
    return {}
  }

  const next = nextRow as DbQueueEntry

  await Promise.all([
    supabase.from('queue_entries')
      .update({ status: 'in-progress', started_at: now, call_count: 1 })
      .eq('id', next.id),
    supabase.from('queue_state')
      .update({ current_serving_number: next.queue_number, updated_at: now })
      .eq('branch_id', branchId),
  ])

  await broadcastDisplaySignal(branchId, 'customer-called', {
    queueNumber: next.queue_number,
    billNumber: next.bill_number,
    callCount: 1,
  })

  await logActivity(supabase, profile.customerId, branchId, 'called',
    next.id, next.queue_number, next.bill_number,
    `Queue #${next.queue_number} called`, profile.id)

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Call specific entry ────────────────────────────────────────
export async function callEntryAction(entryId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const now = new Date().toISOString()

  const { data: entryRow } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('id', entryId)
    .eq('branch_id', branchId)
    .single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry

  const newCallCount = (entry.call_count ?? 0) + 1
  const isRecall = entry.status === 'in-progress'

  const { data: stateRow } = await supabase
    .from('queue_state')
    .select('current_serving_number')
    .eq('branch_id', branchId)
    .single()

  const currentNumber = (stateRow as DbQueueState | null)?.current_serving_number ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: PromiseLike<any>[] = [
    supabase.from('queue_entries').update({
      call_count: newCallCount,
      ...(isRecall
        ? { recall_count: (entry.recall_count ?? 0) + 1 }
        : { status: 'in-progress', started_at: now }),
    }).eq('id', entry.id),
  ]

  if (!isRecall) {
    if (currentNumber > 0 && currentNumber !== entry.queue_number) {
      ops.push(
        supabase.from('queue_entries')
          .update({ status: 'completed', completed_at: now })
          .eq('branch_id', branchId)
          .eq('queue_number', currentNumber)
          .eq('status', 'in-progress')
      )
    }
    ops.push(
      supabase.from('queue_state')
        .update({ current_serving_number: entry.queue_number, updated_at: now })
        .eq('branch_id', branchId)
    )
  }

  await Promise.all(ops)

  await broadcastDisplaySignal(branchId, isRecall ? 'customer-recalled' : 'customer-called', {
    queueNumber: entry.queue_number,
    billNumber: entry.bill_number,
    callCount: newCallCount,
  })

  await logActivity(supabase, profile.customerId, branchId,
    isRecall ? 'recalled' : 'called',
    entry.id, entry.queue_number, entry.bill_number,
    isRecall
      ? `Queue #${entry.queue_number} recalled (×${newCallCount})`
      : `Queue #${entry.queue_number} called`,
    profile.id)

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Cancel entry ──────────────────────────────────────────────
export async function cancelEntryAction(entryId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const { data: entryRow } = await supabase
    .from('queue_entries').select('*').eq('id', entryId).eq('branch_id', branchId).single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry
  const wasInProgress = entry.status === 'in-progress'

  await supabase.from('queue_entries').update({ status: 'cancelled' }).eq('id', entry.id)
  await logActivity(supabase, profile.customerId, branchId, 'cancelled',
    entry.id, entry.queue_number, entry.bill_number,
    `Queue #${entry.queue_number} cancelled`, profile.id)

  if (wasInProgress) {
    await callNextAction(branchId)
    return {}
  }

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Complete entry ────────────────────────────────────────────
export async function completeEntryAction(entryId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const now = new Date().toISOString()
  const { data: entryRow } = await supabase
    .from('queue_entries').select('*').eq('id', entryId).eq('branch_id', branchId).single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry

  await supabase.from('queue_entries')
    .update({ status: 'completed', completed_at: now })
    .eq('id', entry.id)

  await logActivity(supabase, profile.customerId, branchId, 'completed',
    entry.id, entry.queue_number, entry.bill_number,
    `Queue #${entry.queue_number} completed`, profile.id)

  if (entry.status === 'in-progress') {
    await callNextAction(branchId)
    return {}
  }

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Mark no-show ──────────────────────────────────────────────
export async function noShowEntryAction(entryId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const { data: entryRow } = await supabase
    .from('queue_entries').select('*').eq('id', entryId).eq('branch_id', branchId).single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry
  const wasInProgress = entry.status === 'in-progress'

  await supabase.from('queue_entries')
    .update({ status: 'no-show', completed_at: new Date().toISOString() })
    .eq('id', entry.id)

  await logActivity(supabase, profile.customerId, branchId, 'no-show',
    entry.id, entry.queue_number, entry.bill_number,
    `Queue #${entry.queue_number} marked as no-show`, profile.id)

  if (wasInProgress) {
    await callNextAction(branchId)
    return {}
  }

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Call previous ─────────────────────────────────────────────
export async function callPreviousAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const now = new Date().toISOString()

  const { data: stateRow } = await supabase
    .from('queue_state').select('current_serving_number').eq('branch_id', branchId).single()

  const currentNumber = (stateRow as DbQueueState | null)?.current_serving_number ?? 0

  const { data: curRow } = await supabase
    .from('queue_entries').select('*')
    .eq('branch_id', branchId).eq('status', 'in-progress').single()

  const { data: prevRows } = await supabase
    .from('queue_entries').select('*')
    .eq('branch_id', branchId).eq('status', 'completed')
    .lt('queue_number', currentNumber)
    .order('queue_number', { ascending: false })
    .limit(1)

  const prev = prevRows?.[0] as DbQueueEntry | undefined
  if (!prev) { revalidatePath('/dashboard'); return {} }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: PromiseLike<any>[] = [
    supabase.from('queue_entries')
      .update({ status: 'in-progress', started_at: now, completed_at: null })
      .eq('id', prev.id),
    supabase.from('queue_state')
      .update({ current_serving_number: prev.queue_number, updated_at: now })
      .eq('branch_id', branchId),
  ]

  if (curRow) {
    const cur = curRow as DbQueueEntry
    ops.push(supabase.from('queue_entries')
      .update({ status: 'waiting', started_at: null })
      .eq('id', cur.id))
  }

  await Promise.all(ops)

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Add entry (direct, no FormData) ──────────────────────────
export async function addEntryDirectAction(
  branchId: string,
  billNumber: string
): Promise<QueueActionResult> {
  if (!billNumber.trim()) return { error: 'Bill number is required' }

  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Branch not found or access denied' }

  const { data: numData, error: numErr } = await supabase.rpc('claim_queue_number', {
    p_branch_id: branchId,
  })
  if (numErr || numData == null) return { error: 'Failed to assign queue number' }

  const queueNumber = numData as number
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({
      customer_id: profile.customerId,
      branch_id: branchId,
      queue_number: queueNumber,
      bill_number: billNumber.trim(),
      customer_name: '',
      phone: '',
      status: 'waiting',
      source: 'admin',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create entry' }

  const entry = toQueueEntryDTO(data as DbQueueEntry)
  await logActivity(supabase, profile.customerId, branchId, 'joined',
    entry.id, queueNumber, billNumber.trim(),
    `Queue #${queueNumber} joined — Bill ${billNumber} (serve panel)`,
    profile.id)

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return { entry }
}

// ── Reset queue ───────────────────────────────────────────────
export async function resetQueueAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  await supabase.from('queue_entries')
    .update({ status: 'cancelled' })
    .eq('branch_id', branchId)
    .in('status', ['waiting', 'in-progress'])

  await supabase.from('queue_state')
    .update({ current_serving_number: 0, next_queue_number: 1, updated_at: new Date().toISOString() })
    .eq('branch_id', branchId)

  await logActivity(supabase, profile.customerId, branchId, 'reset',
    null, 0, '-', 'Queue reset', profile.id, 'system')

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Toggle queue pause ────────────────────────────────────────
export async function toggleQueuePauseAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = createSupabaseServiceClient()

  const branch = await verifyBranchAccess(supabase, branchId, profile.customerId)
  if (!branch) return { error: 'Access denied' }

  const { data: stateRow } = await supabase
    .from('queue_state').select('is_paused').eq('branch_id', branchId).single()

  const currentlyPaused = (stateRow as { is_paused: boolean } | null)?.is_paused ?? false
  const newPaused = !currentlyPaused

  await supabase.from('queue_state')
    .update({ is_paused: newPaused, updated_at: new Date().toISOString() })
    .eq('branch_id', branchId)

  await logActivity(supabase, profile.customerId, branchId,
    newPaused ? 'paused' : 'resumed',
    null, 0, '-',
    newPaused ? 'Queue paused' : 'Queue resumed',
    profile.id, 'system')

  revalidatePath('/dashboard')
  revalidatePath(`/branches/${branchId}`)
  return {}
}
