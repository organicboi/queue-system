'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireDistributor } from '@/lib/dal/session'
import type { DistributorStats } from '@/lib/db/types'

const LICENSE_KEY_VALIDITY_DAYS = 30

function defaultLicenseKeyExpiry(): string {
  return new Date(Date.now() + LICENSE_KEY_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// ── Create customer + issue license key ───────────────────────
const CreateCustomerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(100),
  planId: z.string().min(1, 'Please select a plan'),
})

export async function createCustomerAction(
  _prev: { error?: string; licenseKey?: string },
  formData: FormData
): Promise<{ error?: string; licenseKey?: string }> {
  await requireDistributor()

  const parsed = CreateCustomerSchema.safeParse({
    businessName: formData.get('businessName'),
    planId: formData.get('planId'),
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
    })
    .select().single()

  if (custErr || !customer) return { error: 'Failed to create customer' }

  // 2. Create initial branch + queue_state
  const { data: branch } = await service
    .from('branches')
    .insert({ customer_id: customer.id, name: 'Main Branch' })
    .select().single()

  if (branch) {
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
  notes?: string
): Promise<{ error?: string; key?: string }> {
  await requireDistributor()
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
    notes: notes ?? '',
    expires_at: defaultLicenseKeyExpiry(),
  }).select().single()

  if (error || !data) return { error: 'Failed to generate key' }

  revalidatePath('/distributor')
  return { key: data.key }
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
