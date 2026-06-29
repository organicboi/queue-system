'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/db/server'

export interface AuthResult {
  error?: string
  step?: number
  planName?: string
  planId?: string
}

// ── Login ─────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function loginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Invalid email or password' }

  redirect('/dashboard')
}

// ── Logout ────────────────────────────────────────────────────
export async function logoutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── Onboard (license key → create customer + admin) ───────────
const OnboardSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  businessName: z.string().max(100).optional(),
  fullName: z.string().min(1, 'Your name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function onboardAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = OnboardSchema.safeParse({
    licenseKey: formData.get('licenseKey'),
    businessName: formData.get('businessName') || undefined,
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Clear any stale session so the proxy doesn't intercept /login after redirect
  const userClient = await createSupabaseServerClient()
  await userClient.auth.signOut()

  const service = createSupabaseServiceClient()

  // 1. Validate license key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: licenseRow } = await service
    .from('license_keys')
    .select('id, plan_id, used_by, expires_at, customer_id, plans(name)')
    .eq('key', parsed.data.licenseKey)
    .single() as { data: any }

  if (!licenseRow) return { error: 'Invalid license key' }
  if (licenseRow.used_by) return { error: 'This license key has already been used' }
  if (licenseRow.expires_at && new Date(licenseRow.expires_at) < new Date()) {
    return { error: 'This license key has expired' }
  }

  // 2. Resolve customer — use pre-created if key has one, else create from form
  let customerId: string

  if (licenseRow.customer_id) {
    // Distributor pre-created the customer — just activate it
    customerId = licenseRow.customer_id
    await service
      .from('customers')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', customerId)
  } else {
    // Standalone key — create customer from form data
    if (!parsed.data.businessName) return { error: 'Business name is required' }

    const slug = parsed.data.businessName
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const { data: customer, error: custErr } = await service
      .from('customers')
      .insert({
        name: parsed.data.businessName,
        business_name: parsed.data.businessName,
        slug,
        plan_id: licenseRow.plan_id,
        onboarded_at: new Date().toISOString(),
      })
      .select().single()

    if (custErr || !customer) return { error: 'Failed to create account. Please try again.' }
    customerId = customer.id
  }

  // 3. Create Supabase Auth user
  const { data: authUser, error: authErr } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (authErr || !authUser.user) {
    if (!licenseRow.customer_id) {
      await service.from('customers').delete().eq('id', customerId)
    }
    if (authErr?.message?.includes('already registered')) {
      return { error: 'An account with this email already exists' }
    }
    return { error: 'Failed to create user account' }
  }

  // 4. Create profile
  const { error: profileErr } = await service.from('profiles').insert({
    id: authUser.user.id,
    customer_id: customerId,
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: 'admin',
  })

  if (profileErr) {
    console.error('[onboardAction] profile insert error:', profileErr.message)
    await service.auth.admin.deleteUser(authUser.user.id)
    if (!licenseRow.customer_id) {
      await service.from('customers').delete().eq('id', customerId)
    }
    return { error: `Failed to create profile: ${profileErr.message}` }
  }

  // 5. Mark license key as used
  await service.from('license_keys').update({
    used_by: customerId,
    used_at: new Date().toISOString(),
  }).eq('id', licenseRow.id)

  // 6. Create branch + queue_state only if standalone key (pre-created customers already have one)
  if (!licenseRow.customer_id) {
    const { data: branch } = await service
      .from('branches')
      .insert({ customer_id: customerId, name: 'Main Branch', location_note: 'Default branch' })
      .select().single()

    if (branch) {
      await service.from('queue_state').insert({ customer_id: customerId, branch_id: branch.id })
    }
  }

  redirect('/login')
}

// ── Distributor login ─────────────────────────────────────────
export async function distributorLoginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const secret = formData.get('secret') as string
  if (!secret || secret !== process.env.DISTRIBUTOR_SECRET) {
    return { error: 'Invalid secret key' }
  }

  const cookieStore = await cookies()
  cookieStore.set('dist_session', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  redirect('/distributor')
}

// ── Distributor logout ────────────────────────────────────────
export async function distributorLogoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('dist_session')
  redirect('/distributor/login')
}
