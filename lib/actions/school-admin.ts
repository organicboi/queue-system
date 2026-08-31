'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireBranchManager } from '@/lib/dal/session'
import { createPairingCode } from '@/lib/dal/device-pairing'
import {
  toSchoolDepartmentDTO, toSchoolCounterDTO, toSchoolSettingsDTO,
  type SchoolDepartmentDTO, type SchoolCounterDTO, type SchoolSettingsDTO,
  type DbSchoolDepartment, type DbSchoolCounter, type DbSchoolSettings,
} from '@/lib/db/school-types'

export interface SchoolDepartmentResult {
  department?: SchoolDepartmentDTO
  error?: string
}

export interface SchoolCounterResult {
  counter?: SchoolCounterDTO
  error?: string
}

export interface SchoolSettingsResult {
  settings?: SchoolSettingsDTO
  error?: string
}

// ── Departments ───────────────────────────────────────────────
const DepartmentSchema = z.object({
  branchId: z.string().uuid(),
  nameEn: z.string().min(1, 'Department name is required').max(100),
  nameAr: z.string().max(100).optional().default(''),
  // The prefix is the visible half of every token this department issues, so
  // it's constrained to what fits on a ticket and reads at TV distance.
  prefix: z.string().regex(/^[A-Za-z]{1,3}$/, 'Prefix must be 1–3 letters'),
  numberStart: z.coerce.number().int().min(1).max(99999).default(101),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0F766E'),
  icon: z.string().max(40).default('Building2'),
  isPriority: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export async function createSchoolDepartmentAction(
  _prev: SchoolDepartmentResult,
  formData: FormData
): Promise<SchoolDepartmentResult> {
  const parsed = DepartmentSchema.safeParse({
    branchId: formData.get('branchId'),
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr') ?? '',
    prefix: formData.get('prefix'),
    numberStart: formData.get('numberStart') || 101,
    color: formData.get('color') || '#0F766E',
    icon: formData.get('icon') || 'Building2',
    isPriority: formData.get('isPriority') === 'on',
    displayOrder: formData.get('displayOrder') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('school_departments')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      name_en: parsed.data.nameEn,
      name_ar: parsed.data.nameAr,
      prefix: parsed.data.prefix.toUpperCase(),
      number_start: parsed.data.numberStart,
      color: parsed.data.color,
      icon: parsed.data.icon,
      is_priority: parsed.data.isPriority,
      display_order: parsed.data.displayOrder,
    })
    .select()
    .single()

  // A duplicate prefix is caught by the partial unique index rather than a
  // read-then-write check, so it can't race two admins adding 'F' at once.
  if (error?.code === '23505') {
    return { error: `Prefix ${parsed.data.prefix.toUpperCase()} is already used by another active department` }
  }
  if (error || !data) return { error: 'Could not create the department' }

  revalidatePath('/school/departments')
  return { department: toSchoolDepartmentDTO(data as DbSchoolDepartment) }
}

export async function updateSchoolDepartmentAction(
  departmentId: string,
  branchId: string,
  patch: Partial<{
    nameEn: string; nameAr: string; prefix: string; numberStart: number
    color: string; icon: string; isPriority: boolean; displayOrder: number
    isActive: boolean
  }>
): Promise<SchoolDepartmentResult> {
  try {
    await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('school_departments')
    .update({
      ...(patch.nameEn !== undefined && { name_en: patch.nameEn }),
      ...(patch.nameAr !== undefined && { name_ar: patch.nameAr }),
      ...(patch.prefix !== undefined && { prefix: patch.prefix.toUpperCase() }),
      ...(patch.numberStart !== undefined && { number_start: patch.numberStart }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.isPriority !== undefined && { is_priority: patch.isPriority }),
      ...(patch.displayOrder !== undefined && { display_order: patch.displayOrder }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', departmentId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That prefix is already in use' }
  if (error || !data) return { error: 'Could not update the department' }

  revalidatePath('/school/departments')
  return { department: toSchoolDepartmentDTO(data as DbSchoolDepartment) }
}

// Departments are never hard-deleted: school_tokens.department_id is ON DELETE
// RESTRICT precisely so a day's history can't be orphaned. Deactivating also
// frees the prefix (the unique index is partial on is_active).
export async function deactivateSchoolDepartmentAction(departmentId: string, branchId: string) {
  return updateSchoolDepartmentAction(departmentId, branchId, { isActive: false })
}

// ── Seed the brochure's departments ───────────────────────────
const DEFAULT_DEPARTMENTS = [
  { nameEn: 'Admissions & Enquiry',     nameAr: 'القبول والاستفسار',   prefix: 'A', icon: 'UserPlus',    color: '#0F766E' },
  { nameEn: 'Fees & Accounts',          nameAr: 'الرسوم والحسابات',    prefix: 'F', icon: 'Receipt',     color: '#1D4ED8' },
  { nameEn: 'Certificates & Documents', nameAr: 'الشهادات والوثائق',   prefix: 'C', icon: 'FileText',    color: '#7C3AED' },
  { nameEn: 'Student Services',         nameAr: 'خدمات الطلاب',        prefix: 'S', icon: 'GraduationCap', color: '#B45309' },
  { nameEn: 'Transport Office',         nameAr: 'مكتب النقل',          prefix: 'T', icon: 'Bus',         color: '#0E7490' },
  { nameEn: 'Reception / Enquiry',      nameAr: 'الاستقبال',           prefix: 'R', icon: 'ConciergeBell', color: '#4338CA' },
  { nameEn: 'Bookstore / Uniform',      nameAr: 'المكتبة والزي',       prefix: 'B', icon: 'ShoppingBag', color: '#BE185D' },
  { nameEn: 'Priority Assistance',      nameAr: 'مساعدة ذوي الأولوية', prefix: 'P', icon: 'Accessibility', color: '#B91C1C', isPriority: true },
]

export async function seedSchoolDepartmentsAction(
  branchId: string
): Promise<{ created?: number; error?: string }> {
  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { data: existing } = await supabase
    .from('school_departments')
    .select('prefix')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  const taken = new Set(((existing ?? []) as { prefix: string }[]).map((d) => d.prefix))
  const rows = DEFAULT_DEPARTMENTS
    .filter((d) => !taken.has(d.prefix))
    .map((d, i) => ({
      customer_id: profile.customerId,
      branch_id: branchId,
      name_en: d.nameEn,
      name_ar: d.nameAr,
      prefix: d.prefix,
      color: d.color,
      icon: d.icon,
      is_priority: d.isPriority ?? false,
      display_order: i + 1,
    }))

  if (rows.length === 0) return { created: 0 }

  const { error } = await supabase.from('school_departments').insert(rows)
  if (error) return { error: 'Could not add the default departments' }

  revalidatePath('/school/departments')
  return { created: rows.length }
}

// ── Counters ──────────────────────────────────────────────────
const CounterSchema = z.object({
  branchId: z.string().uuid(),
  nameEn: z.string().min(1, 'Counter name is required').max(100),
  nameAr: z.string().max(100).optional().default(''),
  keypadCode: z.string().max(8).optional().default(''),
  acceptsPriority: z.coerce.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export async function createSchoolCounterAction(
  _prev: SchoolCounterResult,
  formData: FormData
): Promise<SchoolCounterResult> {
  const parsed = CounterSchema.safeParse({
    branchId: formData.get('branchId'),
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr') ?? '',
    keypadCode: formData.get('keypadCode') ?? '',
    acceptsPriority: formData.get('acceptsPriority') !== 'off',
    displayOrder: formData.get('displayOrder') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('school_counters')
    .insert({
      customer_id: profile.customerId,
      branch_id: parsed.data.branchId,
      name_en: parsed.data.nameEn,
      name_ar: parsed.data.nameAr,
      keypad_code: parsed.data.keypadCode || null,
      accepts_priority: parsed.data.acceptsPriority,
      display_order: parsed.data.displayOrder,
    })
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That keypad code is already used at this branch' }
  if (error || !data) return { error: 'Could not create the counter' }

  revalidatePath('/school/counters')
  return { counter: toSchoolCounterDTO(data as DbSchoolCounter) }
}

// Which departments this window serves, and in what order it prefers them.
// `preference` is a soft ordering — call_next_school_token folds it in as a
// small time penalty so a secondary department can't be starved outright.
export async function setSchoolCounterDepartmentsAction(
  counterId: string,
  branchId: string,
  departmentIds: string[]
): Promise<{ error?: string }> {
  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  await supabase.from('school_counter_departments').delete().eq('counter_id', counterId)

  if (departmentIds.length > 0) {
    const { error } = await supabase.from('school_counter_departments').insert(
      departmentIds.map((departmentId, index) => ({
        customer_id: profile.customerId,
        counter_id: counterId,
        department_id: departmentId,
        preference: index,
      }))
    )
    if (error) return { error: 'Could not save the department assignment' }
  }

  revalidatePath('/school/counters')
  return {}
}

export async function updateSchoolCounterAction(
  counterId: string,
  branchId: string,
  patch: Partial<{
    nameEn: string; nameAr: string; keypadCode: string | null
    acceptsPriority: boolean; displayOrder: number; isActive: boolean; isOpen: boolean
    keypadMap: Record<string, string>
  }>
): Promise<SchoolCounterResult> {
  try {
    await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('school_counters')
    .update({
      ...(patch.nameEn !== undefined && { name_en: patch.nameEn }),
      ...(patch.nameAr !== undefined && { name_ar: patch.nameAr }),
      ...(patch.keypadCode !== undefined && { keypad_code: patch.keypadCode || null }),
      ...(patch.acceptsPriority !== undefined && { accepts_priority: patch.acceptsPriority }),
      ...(patch.displayOrder !== undefined && { display_order: patch.displayOrder }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      ...(patch.isOpen !== undefined && { is_open: patch.isOpen }),
      ...(patch.keypadMap !== undefined && { keypad_map: patch.keypadMap }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', counterId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error?.code === '23505') return { error: 'That keypad code is already used at this branch' }
  if (error || !data) return { error: 'Could not update the counter' }

  revalidatePath('/school/counters')
  return { counter: toSchoolCounterDTO(data as DbSchoolCounter) }
}

export async function regenerateSchoolCounterTokenAction(
  counterId: string,
  branchId: string
): Promise<SchoolCounterResult> {
  try {
    await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from('school_counters')
    .update({ counter_token: token, updated_at: new Date().toISOString() })
    .eq('id', counterId)
    .eq('branch_id', branchId)
    .select()
    .single()

  if (error || !data) return { error: 'Could not regenerate the counter link' }

  revalidatePath('/school/counters')
  return { counter: toSchoolCounterDTO(data as DbSchoolCounter) }
}

// Soft delete, matching deleteScreenAction — the counter is referenced by
// today's tokens and by every activity log row.
export async function deactivateSchoolCounterAction(counterId: string, branchId: string) {
  return updateSchoolCounterAction(counterId, branchId, { isActive: false, isOpen: false })
}

// ── Settings ──────────────────────────────────────────────────
const SettingsSchema = z.object({
  branchId: z.string().uuid(),
  schoolNameEn: z.string().max(120).optional(),
  schoolNameAr: z.string().max(120).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  languages: z.array(z.enum(['en', 'ar'])).min(1).optional(),
  ticketFooterEn: z.string().max(200).optional(),
  ticketFooterAr: z.string().max(200).optional(),
  kioskIdleSeconds: z.coerce.number().int().min(3).max(120).optional(),
  priorityEnabled: z.boolean().optional(),
  announceEnabled: z.boolean().optional(),
  announceTemplateEn: z.string().max(200).optional(),
  announceTemplateAr: z.string().max(200).optional(),
  printEnabled: z.boolean().optional(),
  timezone: z.string().max(60).optional(),
  dayStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

// Upsert: a school branch has no settings row until someone opens the page,
// and the kiosk/board both need one, so creating on first save is correct.
export async function saveSchoolSettingsAction(
  input: z.input<typeof SettingsSchema>
): Promise<SchoolSettingsResult> {
  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let profile
  try {
    profile = await requireBranchManager(parsed.data.branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const d = parsed.data
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('school_settings')
    .upsert({
      customer_id: profile.customerId,
      branch_id: d.branchId,
      ...(d.schoolNameEn !== undefined && { school_name_en: d.schoolNameEn }),
      ...(d.schoolNameAr !== undefined && { school_name_ar: d.schoolNameAr }),
      ...(d.logoUrl !== undefined && { logo_url: d.logoUrl }),
      ...(d.languages !== undefined && { languages: d.languages }),
      ...(d.ticketFooterEn !== undefined && { ticket_footer_en: d.ticketFooterEn }),
      ...(d.ticketFooterAr !== undefined && { ticket_footer_ar: d.ticketFooterAr }),
      ...(d.kioskIdleSeconds !== undefined && { kiosk_idle_seconds: d.kioskIdleSeconds }),
      ...(d.priorityEnabled !== undefined && { priority_enabled: d.priorityEnabled }),
      ...(d.announceEnabled !== undefined && { announce_enabled: d.announceEnabled }),
      ...(d.announceTemplateEn !== undefined && { announce_template_en: d.announceTemplateEn }),
      ...(d.announceTemplateAr !== undefined && { announce_template_ar: d.announceTemplateAr }),
      ...(d.printEnabled !== undefined && { print_enabled: d.printEnabled }),
      ...(d.timezone !== undefined && { timezone: d.timezone }),
      ...(d.dayStartTime !== undefined && { day_start_time: d.dayStartTime }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id' })
    .select()
    .single()

  if (error || !data) return { error: 'Could not save settings' }

  revalidatePath('/school/settings')
  return { settings: toSchoolSettingsDTO(data as DbSchoolSettings) }
}

// ── School TV screens ─────────────────────────────────────────
// Screens are the shared table — that's what gives the school board the ads
// cascade, the plan quota and presence for free. `kind` is the only thing that
// makes one a school board.
export async function createSchoolScreenAction(
  _prev: { error?: string; screenToken?: string },
  formData: FormData
): Promise<{ error?: string; screenToken?: string }> {
  const branchId = String(formData.get('branchId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!branchId || !name) return { error: 'Screen name is required' }

  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()

  // Same plan quota the existing createScreenAction enforces.
  const { count } = await supabase
    .from('screens')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  const { data: planData } = await supabase
    .from('customers')
    .select('plans(max_screens_per_branch)')
    .eq('id', profile.customerId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxScreens = (planData as any)?.plans?.max_screens_per_branch ?? 2
  if ((count ?? 0) >= maxScreens) {
    return { error: `You have reached the maximum number of screens (${maxScreens}) for this branch on your plan.` }
  }

  const { data, error } = await supabase
    .from('screens')
    .insert({
      customer_id: profile.customerId,
      branch_id: branchId,
      name,
      kind: 'school',
      orientation: 'landscape',
    })
    .select('screen_token')
    .single()

  if (error || !data) return { error: 'Could not create the screen' }

  revalidatePath('/school/screens')
  return { screenToken: (data as { screen_token: string }).screen_token }
}

// ── Device pairing codes ──────────────────────────────────────
// The kiosk tablet and the TV have no keyboard and no camera; typing a 48-char
// token or scanning a QR isn't realistic. This mints a 6-digit code the
// operator types into the app's setup wizard once — the app posts it to
// /api/pair and gets the real long token back. See lib/dal/device-pairing.ts.
export interface DevicePairingCodeResult {
  code?: string
  expiresAt?: string
  error?: string
}

export async function createDevicePairingCodeAction(input: {
  branchId: string
  role: 'kiosk' | 'display'
  screenId?: string
}): Promise<DevicePairingCodeResult> {
  const { branchId, role, screenId } = input
  if (role !== 'kiosk' && role !== 'display') return { error: 'Invalid device role' }
  if (role === 'display' && !screenId) return { error: 'A screen is required' }

  let profile
  try {
    profile = await requireBranchManager(branchId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Access denied' }
  }

  const supabase = createSupabaseServiceClient()
  if (role === 'display') {
    // The screen must be a school board on this same branch.
    const { data: screen } = await supabase
      .from('screens')
      .select('id')
      .eq('id', screenId!)
      .eq('branch_id', branchId)
      .eq('kind', 'school')
      .maybeSingle()
    if (!screen) return { error: 'Unknown screen' }
  }

  try {
    const { code, expiresAt } = await createPairingCode({
      customerId: profile.customerId,
      branchId,
      role,
      screenId: screenId ?? null,
      createdBy: profile.id,
    })
    return { code, expiresAt }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create a pairing code' }
  }
}
