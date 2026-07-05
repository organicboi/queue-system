'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireAdmin, requireBranchManager } from '@/lib/dal/session'
import { ACTIVE_BRANCH_COOKIE } from '@/lib/dal/branches'
import { toBranchDTO, toScreenDTO, type BranchDTO, type ScreenDTO, type DbBranch, type DbScreen, type AnnouncementLang } from '@/lib/db/types'

export interface BranchActionResult {
  error?: string
  branch?: BranchDTO
}

export interface ScreenActionResult {
  error?: string
  screen?: ScreenDTO
}

// ── Create branch ─────────────────────────────────────────────
const CreateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  locationNote: z.string().max(200).optional(),
  queueLabel: z.string().max(50).optional(),
})

export async function createBranchAction(
  _prev: BranchActionResult,
  formData: FormData
): Promise<BranchActionResult> {
  const profile = await requireAdmin()
  const parsed = CreateBranchSchema.safeParse({
    name: formData.get('name'),
    locationNote: formData.get('locationNote') || undefined,
    queueLabel: formData.get('queueLabel') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()

  // Check quota
  const { data: canCreate } = await supabase.rpc('check_branch_quota', {
    p_customer_id: profile.customerId,
  })

  if (!canCreate) {
    return { error: 'You have reached the maximum number of branches for your plan. Please upgrade to add more.' }
  }

  const { data, error } = await supabase
    .from('branches')
    .insert({
      customer_id: profile.customerId,
      name: parsed.data.name,
      location_note: parsed.data.locationNote ?? '',
      queue_label: parsed.data.queueLabel ?? 'Queue Number',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create branch' }

  const branch = toBranchDTO(data as DbBranch)

  // Create queue state for new branch
  await supabase.from('queue_state').insert({
    customer_id: profile.customerId,
    branch_id: branch.id,
  })

  revalidatePath('/branches')
  revalidatePath('/dashboard')
  return { branch }
}

// ── Set the admin's active branch (drives /dashboard + the TopBar switcher) ──
export async function setActiveBranchAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!branch) return { error: 'Branch not found' }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return {}
}

// ── Update branch ─────────────────────────────────────────────
const UpdateBranchSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  locationNote: z.string().max(200).optional(),
})

export async function updateBranchAction(
  _prev: BranchActionResult,
  formData: FormData
): Promise<BranchActionResult> {
  const profile = await requireAdmin()
  const parsed = UpdateBranchSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name') || undefined,
    locationNote: formData.get('locationNote') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('branches')
    .update({
      name: parsed.data.name,
      location_note: parsed.data.locationNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.branchId)
    .eq('customer_id', profile.customerId)
    .select()
    .single()

  if (error || !data) return { error: 'Failed to update branch' }

  revalidatePath('/branches')
  revalidatePath(`/branches/${parsed.data.branchId}`)
  return { branch: toBranchDTO(data as DbBranch) }
}

// ── Update branch settings ────────────────────────────────────
const BranchSettingsSchema = z.object({
  branchId: z.string().uuid(),
  queueLabel: z.string().max(50).optional(),
  allowSelfJoin: z.boolean().optional(),
  maxCapacity: z.coerce.number().int().min(1).max(10000).optional(),
  avgServiceTime: z.coerce.number().int().min(1).max(120).optional(),
  soundEnabled: z.boolean().optional(),
  silentPrint: z.boolean().optional(),
  printerName: z.string().max(100).optional(),
  tickerText: z.string().max(500).optional(),
  counterPresenceEnabled: z.boolean().optional(),
})

export async function updateBranchSettingsAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = BranchSettingsSchema.safeParse({
    branchId: formData.get('branchId'),
    queueLabel: formData.get('queueLabel') || undefined,
    allowSelfJoin: formData.get('allowSelfJoin') === 'true',
    maxCapacity: formData.get('maxCapacity') || undefined,
    avgServiceTime: formData.get('avgServiceTime') || undefined,
    soundEnabled: formData.get('soundEnabled') === 'true',
    silentPrint: formData.get('silentPrint') === 'true',
    printerName: formData.get('printerName') || undefined,
    tickerText: formData.get('tickerText') || undefined,
    counterPresenceEnabled: formData.get('counterPresenceEnabled') === 'true',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { branchId, ...updates } = parsed.data

  const { error } = await supabase
    .from('branches')
    .update({
      queue_label: updates.queueLabel,
      allow_self_join: updates.allowSelfJoin,
      max_capacity: updates.maxCapacity,
      avg_service_time: updates.avgServiceTime,
      sound_enabled: updates.soundEnabled,
      silent_print: updates.silentPrint,
      printer_name: updates.printerName,
      ticker_text: updates.tickerText,
      counter_presence_enabled: updates.counterPresenceEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', branchId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update branch settings' }

  revalidatePath(`/branches/${branchId}/settings`)
  revalidatePath(`/branches/${branchId}`)
  return {}
}

// ── Deactivate branch ─────────────────────────────────────────
export async function deactivateBranchAction(branchId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('branches')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', branchId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to deactivate branch' }

  revalidatePath('/branches')
  revalidatePath('/dashboard')
  return {}
}

// ── Create screen ─────────────────────────────────────────────
const CreateScreenSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100),
  orientation: z.enum(['landscape', 'portrait']).optional(),
})

export async function createScreenAction(
  _prev: { error?: string; screen?: ScreenDTO },
  formData: FormData
): Promise<{ error?: string; screen?: ScreenDTO }> {
  const parsed = CreateScreenSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    orientation: formData.get('orientation') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()

  // Verify branch belongs to customer
  const { data: branch } = await supabase
    .from('branches')
    .select('id, customer_id')
    .eq('id', parsed.data.branchId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!branch) return { error: 'Branch not found' }

  // Check max_screens_per_branch
  const { count: screenCount } = await supabase
    .from('screens')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', parsed.data.branchId)
    .eq('is_active', true)

  const { data: planData } = await supabase
    .from('customers')
    .select('plans(max_screens_per_branch)')
    .eq('id', profile.customerId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxScreens = (planData as any)?.plans?.max_screens_per_branch ?? 2
  if ((screenCount ?? 0) >= maxScreens) {
    return { error: `You have reached the maximum number of screens (${maxScreens}) for this branch on your plan.` }
  }

  const { data, error } = await supabase
    .from('screens')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      name: parsed.data.name,
      orientation: parsed.data.orientation ?? 'landscape',
    })
    .select()
    .single()

  if (error || !data) return { error: 'Failed to create screen' }

  revalidatePath(`/branches/${parsed.data.branchId}/screens`)
  return { screen: toScreenDTO(data as DbScreen) }
}

// ── Update screen ─────────────────────────────────────────────
const UpdateScreenSchema = z.object({
  screenId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  layout: z.enum(['split-standard', 'rates-wide', 'rates-full', 'ads-full', 'portrait']).nullable().optional(),
  theme: z.enum(['standard', 'dark', 'vibrant', 'minimal']).nullable().optional(),
  showAds: z.boolean().nullable().optional(),
  showTicker: z.boolean().nullable().optional(),
  showClock: z.boolean().optional(),
  showEstimatedWait: z.boolean().optional(),
  numbersToShow: z.coerce.number().int().min(1).max(20).optional(),
  orientation: z.enum(['landscape', 'portrait']).optional(),
})

export async function updateScreenAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = UpdateScreenSchema.safeParse({
    screenId: formData.get('screenId'),
    branchId: formData.get('branchId'),
    name: formData.get('name') || undefined,
    layout: formData.get('layout') || null,
    theme: formData.get('theme') || null,
    showAds: formData.get('showAds') != null ? formData.get('showAds') === 'true' : null,
    showTicker: formData.get('showTicker') != null ? formData.get('showTicker') === 'true' : null,
    showClock: formData.get('showClock') === 'true',
    showEstimatedWait: formData.get('showEstimatedWait') === 'true',
    numbersToShow: formData.get('numbersToShow') || undefined,
    orientation: formData.get('orientation') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { screenId, branchId, ...updates } = parsed.data

  const { error } = await supabase
    .from('screens')
    .update({
      name: updates.name,
      layout: updates.layout,
      theme: updates.theme,
      show_ads: updates.showAds,
      show_ticker: updates.showTicker,
      show_clock: updates.showClock,
      show_estimated_wait: updates.showEstimatedWait,
      numbers_to_show: updates.numbersToShow,
      orientation: updates.orientation,
      updated_at: new Date().toISOString(),
    })
    .eq('id', screenId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update screen' }

  revalidatePath(`/branches/${branchId}/screens`)
  return {}
}

// ── Regenerate screen token ────────────────────────────────────
export async function regenerateScreenTokenAction(
  screenId: string,
  branchId: string
): Promise<{ error?: string; token?: string }> {
  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }
  const supabase = createSupabaseServiceClient()

  const { data, error } = await supabase.rpc('regenerate_screen_token', { p_screen_id: screenId })

  if (error) {
    // Fallback: do it in app code
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const { error: updateErr } = await supabase
      .from('screens')
      .update({ screen_token: newToken, updated_at: new Date().toISOString() })
      .eq('id', screenId)
      .eq('customer_id', profile.customerId)

    if (updateErr) return { error: 'Failed to regenerate token' }

    revalidatePath(`/branches/${branchId}/screens`)
    return { token: newToken }
  }

  revalidatePath(`/branches/${branchId}/screens`)
  return { token: data as string }
}

// ── Update screen announcement language ───────────────────────
export async function updateScreenAnnouncementLangAction(
  screenId: string,
  branchId: string,
  lang: AnnouncementLang
): Promise<{ error?: string }> {
  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('screens')
    .update({ announcement_lang: lang, updated_at: new Date().toISOString() })
    .eq('id', screenId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update announcement language' }

  revalidatePath(`/branches/${branchId}/screens`)
  return {}
}

// ── Delete screen ─────────────────────────────────────────────
export async function deleteScreenAction(screenId: string, branchId: string): Promise<{ error?: string }> {
  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }
  const supabase = createSupabaseServiceClient()

  const { error } = await supabase
    .from('screens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', screenId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to delete screen' }

  revalidatePath(`/branches/${branchId}/screens`)
  return {}
}
