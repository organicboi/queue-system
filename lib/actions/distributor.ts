'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireDistributor } from '@/lib/dal/session'
import type { CustomerVertical, DistributorStats } from '@/lib/db/types'
import { MAX_SCHOOL_ENTITLEMENT } from '@/lib/db/types'
import { DEFAULT_VERTICAL, VERTICALS, isVertical } from '@/lib/verticals'

const LICENSE_KEY_VALIDITY_DAYS = 30

function defaultLicenseKeyExpiry(): string {
  return new Date(Date.now() + LICENSE_KEY_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// ── Create customer + issue license key ───────────────────────
const VerticalSchema = z
  .enum(VERTICALS.map((v) => v.value) as [CustomerVertical, ...CustomerVertical[]])
  .default(DEFAULT_VERTICAL)

const CreateCustomerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(100),
  planId: z.string().min(1, 'Please select a plan'),
  // Which product this customer is being sold. Chosen here, at the point of
  // sale, rather than patched onto the customer after onboarding.
  vertical: VerticalSchema,
})

export async function createCustomerAction(
  _prev: { error?: string; licenseKey?: string },
  formData: FormData
): Promise<{ error?: string; licenseKey?: string }> {
  await requireDistributor()

  const parsed = CreateCustomerSchema.safeParse({
    businessName: formData.get('businessName'),
    planId: formData.get('planId'),
    vertical: formData.get('vertical') ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = createSupabaseServiceClient()

  const slug = parsed.data.businessName
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).slice(2, 6)

  // 1. Create customer
  const { data: customer, error: custErr } = await service
    .from('customers')
    .insert({
      name: parsed.data.businessName,
      business_name: parsed.data.businessName,
      slug,
      plan_id: parsed.data.planId,
      vertical: parsed.data.vertical,
    })
    .select().single()

  if (custErr || !customer) return { error: 'Failed to create customer' }

  // 2. Create initial branch + queue_state
  const { data: branch } = await service
    .from('branches')
    .insert({ customer_id: customer.id, name: 'Main Branch' })
    .select().single()

  // queue_state is the hotel product's per-branch serving pointer; a school
  // branch serves from N windows at once and never reads it.
  if (branch && parsed.data.vertical !== 'school') {
    await service.from('queue_state').insert({ customer_id: customer.id, branch_id: branch.id })
  }

  // 3. Generate a unique license key linked to this customer
  const key = [
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
  ].join('-')

  const { error: keyErr } = await service.from('license_keys').insert({
    key,
    plan_id: parsed.data.planId,
    customer_id: customer.id,
    vertical: parsed.data.vertical,
    notes: `Created for ${parsed.data.businessName}`,
    expires_at: defaultLicenseKeyExpiry(),
  })

  if (keyErr) {
    if (branch) await service.from('queue_state').delete().eq('branch_id', branch.id)
    await service.from('branches').delete().eq('customer_id', customer.id)
    await service.from('customers').delete().eq('id', customer.id)
    return { error: 'Failed to generate license key' }
  }

  revalidatePath('/distributor/customers')
  return { licenseKey: key }
}

// ── Generate license key ──────────────────────────────────────
export async function generateLicenseKeyAction(
  planId: string,
  notes?: string,
  vertical: CustomerVertical = DEFAULT_VERTICAL
): Promise<{ error?: string; key?: string }> {
  await requireDistributor()
  if (!isVertical(vertical)) return { error: 'Unknown system' }
  const service = createSupabaseServiceClient()

  const key = [
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
    Math.random().toString(36).slice(2, 6).toUpperCase(),
  ].join('-')

  const { data, error } = await service.from('license_keys').insert({
    key,
    plan_id: planId,
    vertical,
    notes: notes ?? '',
    expires_at: defaultLicenseKeyExpiry(),
  }).select().single()

  if (error || !data) return { error: 'Failed to generate key' }

  revalidatePath('/distributor')
  revalidatePath('/distributor/keys')
  return { key: data.key }
}

// ── Change the system on an unused key ────────────────────────
// Only while the key is unredeemed. Once used_by is set the tenant exists and
// may already hold rows in that product's tables, so flipping the key would
// leave the customer's vertical and its data disagreeing — the customer would
// open an empty product with its real data stranded in the other one.
export async function setLicenseKeyVerticalAction(
  keyId: string,
  vertical: CustomerVertical
): Promise<{ error?: string }> {
  await requireDistributor()
  if (!isVertical(vertical)) return { error: 'Unknown system' }

  const service = createSupabaseServiceClient()

  const { data: existing } = await service
    .from('license_keys')
    .select('id, used_by, customer_id')
    .eq('id', keyId)
    .maybeSingle()

  if (!existing) return { error: 'Key not found' }
  if ((existing as { used_by: string | null }).used_by) {
    return { error: 'This key has already been redeemed — its system is locked' }
  }

  const { error } = await service
    .from('license_keys')
    .update({ vertical })
    .eq('id', keyId)

  if (error) return { error: 'Could not change the system for this key' }

  // A pre-created customer must move with its key, or redeeming it would hand
  // the customer a product its own row disagrees with.
  const customerId = (existing as { customer_id: string | null }).customer_id
  if (customerId) {
    await service.from('customers').update({ vertical }).eq('id', customerId)
  }

  revalidatePath('/distributor/keys')
  revalidatePath('/distributor/customers')
  return {}
}

// ── Toggle customer active ────────────────────────────────────
export async function toggleCustomerActiveAction(customerId: string): Promise<{ error?: string }> {
  await requireDistributor()
  const service = createSupabaseServiceClient()

  const { data } = await service.from('customers').select('is_active').eq('id', customerId).single()
  if (!data) return { error: 'Customer not found' }

  const { error } = await service
    .from('customers')
    .update({ is_active: !data.is_active, updated_at: new Date().toISOString() })
    .eq('id', customerId)

  if (error) return { error: 'Failed to update customer' }

  revalidatePath('/distributor/customers')
  return {}
}

// ── Change plan ───────────────────────────────────────────────
export async function changePlanAction(customerId: string, planId: string): Promise<{ error?: string }> {
  await requireDistributor()
  const service = createSupabaseServiceClient()

  const { error } = await service
    .from('customers')
    .update({ plan_id: planId, updated_at: new Date().toISOString() })
    .eq('id', customerId)

  if (error) return { error: 'Failed to change plan' }

  revalidatePath('/distributor/customers')
  return {}
}

// ── School entitlements ───────────────────────────────────────
// How many departments and counters a school tenant may run, per branch. A new
// customer starts at 1 of each; raising it is a sale, so it lives here rather
// than anywhere the tenant can reach.
//
// Lowering below what the tenant already runs is allowed and deliberately
// non-destructive: existing rows keep working, but no new one can be added
// until they deactivate down to the new ceiling.
const SchoolLimitsSchema = z.object({
  maxSchoolDepartments: z.coerce.number().int().min(0).max(MAX_SCHOOL_ENTITLEMENT),
  maxSchoolCounters: z.coerce.number().int().min(0).max(MAX_SCHOOL_ENTITLEMENT),
})

export async function setCustomerSchoolLimitsAction(
  customerId: string,
  limits: { maxSchoolDepartments: number; maxSchoolCounters: number }
): Promise<{ error?: string }> {
  await requireDistributor()

  const parsed = SchoolLimitsSchema.safeParse(limits)
  if (!parsed.success) {
    return { error: `Enter a number between 0 and ${MAX_SCHOOL_ENTITLEMENT}` }
  }

  const service = createSupabaseServiceClient()
  const { error } = await service
    .from('customers')
    .update({
      max_school_departments: parsed.data.maxSchoolDepartments,
      max_school_counters: parsed.data.maxSchoolCounters,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)

  if (error) return { error: 'Could not update the limits' }

  revalidatePath('/distributor/customers')
  return {}
}

// ── Distributor stats ─────────────────────────────────────────
export async function getDistributorStats(): Promise<DistributorStats> {
  await requireDistributor()
  const service = createSupabaseServiceClient()

  const { data } = await service.rpc('get_distributor_stats')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stats = data as any
  return {
    totalCustomers: stats?.totalCustomers ?? 0,
    activeCustomers: stats?.activeCustomers ?? 0,
    totalBranches: stats?.totalBranches ?? 0,
    entriesToday: stats?.entriesToday ?? 0,
  }
}
