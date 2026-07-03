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
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'branch_user']),
  branchIds: z.array(z.string().uuid()).optional(),
})

export async function inviteUserAction(
  _prev: { error?: string; password?: string; email?: string },
  formData: FormData
): Promise<{ error?: string; password?: string; email?: string }> {
  const profile = await requireAdmin()

  const branchIdsRaw = formData.get('branchIds')
  const branchIds = branchIdsRaw
    ? (JSON.parse(branchIdsRaw as string) as string[])
    : []

  const parsed = InviteSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    password: formData.get('password'),
    role: formData.get('role'),
    branchIds,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = createSupabaseServiceClient()

  const { data: authUser, error: authErr } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
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
  return { password: parsed.data.password, email: parsed.data.email }
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

// ── Reset user password ─────────────────────────────────────────
const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function resetUserPasswordAction(userId: string, password: string): Promise<{ error?: string; password?: string }> {
  const profile = await requireAdmin()

  const parsed = ResetPasswordSchema.safeParse({ password })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = createSupabaseServiceClient()

  const { data: target } = await service
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!target) return { error: 'User not found' }

  const { error } = await service.auth.admin.updateUserById(userId, { password: parsed.data.password })
  if (error) return { error: 'Failed to reset password' }

  return { password: parsed.data.password }
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

// ── Delete user ────────────────────────────────────────────────
export async function deleteUserAction(userId: string): Promise<{ error?: string }> {
  const profile = await requireAdmin()

  if (userId === profile.id) return { error: 'You cannot delete your own account' }

  const service = createSupabaseServiceClient()

  const { data: target } = await service
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('customer_id', profile.customerId)
    .single()

  if (!target) return { error: 'User not found' }

  await service.from('user_branches').delete().eq('user_id', userId).eq('customer_id', profile.customerId)

  const { error: profileErr } = await service
    .from('profiles')
    .delete()
    .eq('id', userId)
    .eq('customer_id', profile.customerId)

  if (profileErr) return { error: 'Failed to delete user' }

  const { error: authErr } = await service.auth.admin.deleteUser(userId)
  if (authErr) return { error: 'User profile deleted, but failed to remove auth account' }

  revalidatePath('/users')
  return {}
}
