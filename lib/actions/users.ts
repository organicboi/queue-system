'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/dal/session'
import type { UserRole } from '@/lib/db/types'

// ── Invite user ───────────────────────────────────────────────
const InviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(100),
  role: z.enum(['admin', 'branch_user']),
  branchIds: z.array(z.string().uuid()).optional(),
})

export async function inviteUserAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const profile = await requireAdmin()

  const branchIdsRaw = formData.get('branchIds')
  const branchIds = branchIdsRaw
    ? (JSON.parse(branchIdsRaw as string) as string[])
    : []

  const parsed = InviteSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
    branchIds,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = createSupabaseServiceClient()

  // Generate temp password
  const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1'

  const { data: authUser, error: authErr } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authErr || !authUser.user) {
    if (authErr?.message?.includes('already registered')) {
      return { error: 'A user with this email already exists' }
    }
    return { error: 'Failed to create user account' }
  }

  const { error: profileErr } = await service.from('profiles').insert({
    id: authUser.user.id,
    customer_id: profile.customerId,
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
  })

  if (profileErr) {
    await service.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Failed to create user profile' }
  }

  // Assign branches
  if (parsed.data.branchIds?.length) {
    const assignments = parsed.data.branchIds.map(branchId => ({
      customer_id: profile.customerId,
      user_id: authUser.user!.id,
      branch_id: branchId,
    }))
    await service.from('user_branches').insert(assignments)
  }

  revalidatePath('/users')
  return {}
}

// ── Update user role ──────────────────────────────────────────
export async function updateUserRoleAction(
  userId: string,
  role: UserRole
): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const service = createSupabaseServiceClient()

  const { error } = await service
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to update role' }

  revalidatePath('/users')
  return {}
}

// ── Assign user branches ──────────────────────────────────────
export async function assignUserBranchesAction(
  userId: string,
  branchIds: string[]
): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const service = createSupabaseServiceClient()

  // Delete existing assignments
  await service
    .from('user_branches')
    .delete()
    .eq('user_id', userId)
    .eq('customer_id', profile.customerId)

  // Insert new ones
  if (branchIds.length > 0) {
    const assignments = branchIds.map(branchId => ({
      customer_id: profile.customerId,
      user_id: userId,
      branch_id: branchId,
    }))
    const { error } = await service.from('user_branches').insert(assignments)
    if (error) return { error: 'Failed to assign branches' }
  }

  revalidatePath('/users')
  return {}
}

// ── Deactivate user ───────────────────────────────────────────
export async function deactivateUserAction(userId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const service = createSupabaseServiceClient()

  const { error } = await service
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to deactivate user' }

  revalidatePath('/users')
  return {}
}

// ── Reactivate user ───────────────────────────────────────────
export async function reactivateUserAction(userId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()
  const service = createSupabaseServiceClient()

  const { error } = await service
    .from('profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('customer_id', profile.customerId)

  if (error) return { error: 'Failed to reactivate user' }

  revalidatePath('/users')
  return {}
}
