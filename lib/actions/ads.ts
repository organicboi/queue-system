'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/dal/session'

// ── Create ad ─────────────────────────────────────────────────
const AdSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100),
  fileUrl: z.string().url(),
  fileType: z.enum(['image', 'video']),
  durationSeconds: z.coerce.number().int().min(3).max(120).optional(),
})

export async function createAdAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const parsed = AdSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    fileUrl: formData.get('fileUrl'),
    fileType: formData.get('fileType'),
    durationSeconds: formData.get('durationSeconds') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('id', parsed.data.branchId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!branch) return { error: 'Branch not found' }

  const { data: last } = await supabase
    .from('ads')
    .select('display_order')
    .eq('branch_id', parsed.data.branchId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const displayOrder = ((last?.display_order ?? 0) as number) + 1

  const { error } = await supabase.from('ads').insert({
    customer_id: profile.customerId,
    branch_id: parsed.data.branchId,
    name: parsed.data.name,
    file_url: parsed.data.fileUrl,
    file_type: parsed.data.fileType,
    duration_seconds: parsed.data.durationSeconds ?? 8,
    display_order: displayOrder,
  })

  if (error) return { error: 'Failed to create ad' }

  revalidatePath(`/branches/${parsed.data.branchId}/ads`)
  return {}
}

// ── Toggle ad active ──────────────────────────────────────────
export async function toggleAdActiveAction(adId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { data: ad } = await supabase
    .from('ads')
    .select('is_active')
    .eq('id', adId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!ad) return { error: 'Ad not found' }

  const { error } = await supabase
    .from('ads')
    .update({ is_active: !ad.is_active, updated_at: new Date().toISOString() })
    .eq('id', adId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update ad' }

  revalidatePath(`/branches/${branchId}/ads`)
  return {}
}

// ── Delete ad ─────────────────────────────────────────────────
export async function deleteAdAction(adId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('ads')
    .delete()
    .eq('id', adId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to delete ad' }

  revalidatePath(`/branches/${branchId}/ads`)
  return {}
}

// ── Reorder ads ───────────────────────────────────────────────
export async function reorderAdsAction(branchId: string, orderedIds: string[]): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('ads')
        .update({ display_order: idx + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('customer_id', profile.customerId)
    )
  )

  revalidatePath(`/branches/${branchId}/ads`)
  return {}
}

// ── Create ticker message ─────────────────────────────────────
const TickerSchema = z.object({
  branchId: z.string().uuid(),
  message: z.string().min(1).max(500),
})

export async function createTickerAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const parsed = TickerSchema.safeParse({
    branchId: formData.get('branchId'),
    message: formData.get('message'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()

  const { data: last } = await supabase
    .from('ticker_messages')
    .select('display_order')
    .eq('branch_id', parsed.data.branchId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const displayOrder = ((last?.display_order ?? 0) as number) + 1

  const { error } = await supabase.from('ticker_messages').insert({
    customer_id: profile.customerId,
    branch_id: parsed.data.branchId,
    message: parsed.data.message,
    display_order: displayOrder,
    is_active: true,
  })

  if (error) return { error: 'Failed to create ticker message' }

  revalidatePath(`/branches/${parsed.data.branchId}/ads`)
  return {}
}

// ── Toggle ticker active ──────────────────────────────────────
export async function toggleTickerActiveAction(tickerId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { data: ticker } = await supabase
    .from('ticker_messages')
    .select('is_active')
    .eq('id', tickerId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!ticker) return { error: 'Ticker not found' }

  const { error } = await supabase
    .from('ticker_messages')
    .update({ is_active: !ticker.is_active })
    .eq('id', tickerId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update ticker' }

  revalidatePath(`/branches/${branchId}/ads`)
  return {}
}

// ── Delete ticker message ──────────────────────────────────────
export async function deleteTickerAction(tickerId: string, branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('ticker_messages')
    .delete()
    .eq('id', tickerId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to delete ticker message' }

  revalidatePath(`/branches/${branchId}/ads`)
  return {}
}
