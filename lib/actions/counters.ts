'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/dal/session'
import { toCounterDTO, type CounterDTO, type DbCounter, type DbQueueEntry, type DbQueueState, type CounterType, type KitchenStatus } from '@/lib/db/types'

// ── Token auth helper ─────────────────────────────────────────
async function verifyCounterToken(token: string) {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('counters')
    .select('id, customer_id, branch_id, type, is_active')
    .eq('counter_token', token)
    .single()
  if (!data || !data.is_active) return null
  return data as { id: string; customer_id: string; branch_id: string; type: string; is_active: boolean }
}

async function broadcastDisplaySignal(
  branchId: string,
  event: 'customer-called' | 'customer-recalled',
  payload: { queueNumber: number; billNumber: string; callCount: number }
) {
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
  } catch { /* non-critical */ }
}

// ── Presence heartbeat ──────────────────────────────────────────
// Called periodically by the counter page while it's open in a browser
// tab, so admins/other counters can tell whether staff are actually
// looking at it right now vs. it being left open-but-unattended.
export async function counterHeartbeatAction(counterToken: string): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter) return { error: 'Invalid or inactive counter' }

  const supabase = createSupabaseServiceClient()
  await supabase
    .from('counters')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', counter.id)

  return {}
}

// ── Counter Queue Actions (authenticated by counter token) ─────

// Kitchen counter updates its own kitchen_status lifecycle
export async function counterUpdateKitchenStatusAction(
  entryId: string,
  branchId: string,
  newStatus: 'preparing' | 'ready',
  counterToken: string
): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter || counter.branch_id !== branchId) return { error: 'Invalid or inactive counter' }
  if (counter.type !== 'kitchen') return { error: 'Only kitchen counters can update kitchen status' }

  const supabase = createSupabaseServiceClient()

  const { data: entryRow } = await supabase
    .from('queue_entries')
    .select('queue_number, bill_number, status')
    .eq('id', entryId)
    .eq('branch_id', branchId)
    .single()

  if (!entryRow) return { error: 'Entry not found' }
  if (entryRow.status !== 'waiting') return { error: 'Order is no longer in queue' }

  await supabase.from('queue_entries')
    .update({ kitchen_status: newStatus })
    .eq('id', entryId)

  await supabase.from('activity_logs').insert({
    customer_id: counter.customer_id,
    branch_id: branchId,
    entry_id: entryId,
    source: 'admin',
    type: 'called',
    queue_number: entryRow.queue_number,
    bill_number: entryRow.bill_number,
    message: `Queue #${entryRow.queue_number} kitchen: ${newStatus}`,
  })

  return {}
}

// Billing and delivery counters call next KITCHEN-READY entry
export async function counterCallNextAction(
  branchId: string,
  counterToken: string
): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter || counter.branch_id !== branchId) return { error: 'Invalid or inactive counter' }
  if (counter.type === 'kitchen') return { error: 'Kitchen counter does not use call next' }

  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: stateRow } = await supabase
    .from('queue_state')
    .select('current_serving_number')
    .eq('branch_id', branchId)
    .single()

  const currentNumber = (stateRow as DbQueueState | null)?.current_serving_number ?? 0

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
      await supabase.from('activity_logs').insert({
        customer_id: counter.customer_id,
        branch_id: branchId,
        entry_id: cur.id,
        source: 'admin',
        type: 'completed',
        queue_number: cur.queue_number,
        bill_number: cur.bill_number,
        message: `Queue #${cur.queue_number} completed via counter`,
      })
    }
  }

  // Only call entries that are kitchen-ready
  const { data: nextRow } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('branch_id', branchId)
    .eq('status', 'waiting')
    .eq('kitchen_status', 'ready')
    .order('queue_number', { ascending: true })
    .limit(1)
    .single()

  if (!nextRow) return {}

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

  await supabase.from('activity_logs').insert({
    customer_id: counter.customer_id,
    branch_id: branchId,
    entry_id: next.id,
    source: 'admin',
    type: 'called',
    queue_number: next.queue_number,
    bill_number: next.bill_number,
    message: `Queue #${next.queue_number} called via ${counter.type} counter`,
  })

  return {}
}

// Call or recall a specific entry (billing/delivery counters).
// First call on a waiting, kitchen-ready entry brings it "to the counter";
// calling the same in-progress entry again counts as a recall.
export async function counterCallEntryAction(
  entryId: string,
  branchId: string,
  counterToken: string
): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter || counter.branch_id !== branchId) return { error: 'Invalid or inactive counter' }
  if (counter.type === 'kitchen') return { error: 'Kitchen counter does not use call/recall' }

  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: entryRow } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('id', entryId)
    .eq('branch_id', branchId)
    .single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry

  if (entry.status !== 'waiting' && entry.status !== 'in-progress') {
    return { error: 'Order is no longer in queue' }
  }
  if (entry.status === 'waiting' && entry.kitchen_status !== 'ready') {
    return { error: 'Order is not ready yet' }
  }

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

  await supabase.from('activity_logs').insert({
    customer_id: counter.customer_id,
    branch_id: branchId,
    entry_id: entry.id,
    source: 'admin',
    type: isRecall ? 'recalled' : 'called',
    queue_number: entry.queue_number,
    bill_number: entry.bill_number,
    message: isRecall
      ? `Queue #${entry.queue_number} recalled via ${counter.type} counter (×${newCallCount})`
      : `Queue #${entry.queue_number} called via ${counter.type} counter`,
  })

  return {}
}

export async function counterCompleteEntryAction(
  entryId: string,
  branchId: string,
  counterToken: string
): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter || counter.branch_id !== branchId) return { error: 'Invalid or inactive counter' }

  const supabase = createSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: entryRow } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('id', entryId)
    .eq('branch_id', branchId)
    .single()

  if (!entryRow) return { error: 'Entry not found' }
  const entry = entryRow as DbQueueEntry

  await supabase.from('queue_entries')
    .update({ status: 'completed', completed_at: now })
    .eq('id', entryId)

  await supabase.from('activity_logs').insert({
    customer_id: counter.customer_id,
    branch_id: branchId,
    entry_id: entryId,
    source: 'admin',
    type: 'completed',
    queue_number: entry.queue_number,
    bill_number: entry.bill_number,
    message: `Queue #${entry.queue_number} completed via counter`,
  })

  return {}
}

export async function counterCancelEntryAction(
  entryId: string,
  branchId: string,
  counterToken: string
): Promise<{ error?: string }> {
  const counter = await verifyCounterToken(counterToken)
  if (!counter || counter.branch_id !== branchId) return { error: 'Invalid or inactive counter' }

  const supabase = createSupabaseServiceClient()

  const { data: entryRow } = await supabase
    .from('queue_entries')
    .select('queue_number, bill_number')
    .eq('id', entryId)
    .eq('branch_id', branchId)
    .single()

  if (!entryRow) return { error: 'Entry not found' }

  await supabase.from('queue_entries')
    .update({ status: 'cancelled' })
    .eq('id', entryId)

  await supabase.from('activity_logs').insert({
    customer_id: counter.customer_id,
    branch_id: branchId,
    entry_id: entryId,
    source: 'admin',
    type: 'cancelled',
    queue_number: entryRow.queue_number,
    bill_number: entryRow.bill_number,
    message: `Queue #${entryRow.queue_number} cancelled via counter`,
  })

  return {}
}

export interface CounterActionResult {
  error?: string
  counter?: CounterDTO
}

const CreateCounterSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1, 'Counter name is required').max(100),
  type: z.enum(['billing', 'kitchen', 'delivery']),
})

// ── Create counter ────────────────────────────────────────────
export async function createCounterAction(
  _prev: CounterActionResult,
  formData: FormData
): Promise<CounterActionResult> {
  const profile = await requireAdmin()
  const parsed = CreateCounterSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    type: formData.get('type'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()

  // Verify branch belongs to customer
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('id', parsed.data.branchId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!branch) return { error: 'Branch not found' }

  const { data, error } = await supabase
    .from('counters')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      name: parsed.data.name,
      type: parsed.data.type,
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create counter' }

  revalidatePath(`/branches/${parsed.data.branchId}/counters`)
  return { counter: toCounterDTO(data as DbCounter) }
}

// ── Toggle counter active/inactive ────────────────────────────
export async function toggleCounterAction(
  counterId: string,
  branchId: string
): Promise<{ error?: string; isActive?: boolean }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('counters')
    .select('is_active')
    .eq('id', counterId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!existing) return { error: 'Counter not found' }

  const { data, error } = await supabase
    .from('counters')
    .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
    .eq('id', counterId)
    .eq('customer_id', profile.customerId)
    .select('is_active')
    .single()

  if (error || !data) return { error: 'Failed to update counter' }

  revalidatePath(`/branches/${branchId}/counters`)
  return { isActive: data.is_active }
}

// ── Revoke counter access (regenerate token) ──────────────────
export async function revokeCounterAction(
  counterId: string,
  branchId: string
): Promise<{ error?: string; token?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const { data, error } = await supabase
    .from('counters')
    .update({ counter_token: newToken, updated_at: new Date().toISOString() })
    .eq('id', counterId)
    .eq('customer_id', profile.customerId)
    .select('counter_token')
    .single()

  if (error || !data) return { error: 'Failed to revoke counter access' }

  revalidatePath(`/branches/${branchId}/counters`)
  return { token: data.counter_token }
}

// ── Update counter name/type ───────────────────────────────────
const UpdateCounterSchema = z.object({
  counterId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['billing', 'kitchen', 'delivery']).optional(),
})

export async function updateCounterAction(
  _prev: CounterActionResult,
  formData: FormData
): Promise<CounterActionResult> {
  const profile = await requireAdmin()
  const parsed = UpdateCounterSchema.safeParse({
    counterId: formData.get('counterId'),
    branchId: formData.get('branchId'),
    name: formData.get('name') || undefined,
    type: (formData.get('type') as CounterType) || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()
  const { counterId, branchId, ...updates } = parsed.data

  const { data, error } = await supabase
    .from('counters')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', counterId)
    .eq('customer_id', profile.customerId)
    .select()
    .single()

  if (error || !data) return { error: 'Failed to update counter' }

  revalidatePath(`/branches/${branchId}/counters`)
  return { counter: toCounterDTO(data as DbCounter) }
}

// ── Delete counter ─────────────────────────────────────────────
export async function deleteCounterAction(
  counterId: string,
  branchId: string
): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('counters')
    .delete()
    .eq('id', counterId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to delete counter' }

  revalidatePath(`/branches/${branchId}/counters`)
  return {}
}
