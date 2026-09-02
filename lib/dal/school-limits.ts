import 'server-only'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  DEFAULT_SCHOOL_DEPARTMENT_LIMIT,
  DEFAULT_SCHOOL_COUNTER_LIMIT,
} from '@/lib/db/types'

// Departments and counters are sold capacity: the distributor sets the ceiling
// on the customer row, the tenant spends it from /school/departments and
// /school/counters. Counted per branch (matching plans.max_screens_per_branch)
// and over ACTIVE rows only — neither is ever hard-deleted, so deactivating is
// how a tenant frees a slot.

export type { SchoolQuota } from '@/lib/db/school-types'
import type { SchoolQuota } from '@/lib/db/school-types'

export interface SchoolQuotas {
  departments: SchoolQuota
  counters: SchoolQuota
}

// Deliberately not react-cache'd: a server action reads this immediately
// before inserting, and a stale count would hand out a slot twice.
async function readLimits(customerId: string): Promise<{ departments: number; counters: number }> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('customers')
    .select('max_school_departments, max_school_counters')
    .eq('id', customerId)
    .maybeSingle()

  const row = data as { max_school_departments: number | null; max_school_counters: number | null } | null
  return {
    departments: row?.max_school_departments ?? DEFAULT_SCHOOL_DEPARTMENT_LIMIT,
    counters: row?.max_school_counters ?? DEFAULT_SCHOOL_COUNTER_LIMIT,
  }
}

async function countActive(table: 'school_departments' | 'school_counters', branchId: string): Promise<number> {
  const supabase = createSupabaseServiceClient()
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)
  return count ?? 0
}

function quota(limit: number, used: number): SchoolQuota {
  return { limit, used, remaining: Math.max(0, limit - used) }
}

export async function getSchoolDepartmentQuota(customerId: string, branchId: string): Promise<SchoolQuota> {
  const [limits, used] = await Promise.all([readLimits(customerId), countActive('school_departments', branchId)])
  return quota(limits.departments, used)
}

export async function getSchoolCounterQuota(customerId: string, branchId: string): Promise<SchoolQuota> {
  const [limits, used] = await Promise.all([readLimits(customerId), countActive('school_counters', branchId)])
  return quota(limits.counters, used)
}

export async function getSchoolQuotas(customerId: string, branchId: string): Promise<SchoolQuotas> {
  const [limits, departmentsUsed, countersUsed] = await Promise.all([
    readLimits(customerId),
    countActive('school_departments', branchId),
    countActive('school_counters', branchId),
  ])
  return {
    departments: quota(limits.departments, departmentsUsed),
    counters: quota(limits.counters, countersUsed),
  }
}

// One wording for both, so the tenant always learns the same thing: the cap is
// not theirs to raise.
export function quotaReachedMessage(kind: 'department' | 'counter', limit: number): string {
  const plural = kind === 'department' ? 'departments' : 'counters'
  return limit === 0
    ? `No ${plural} are included in your plan. Ask your provider to assign some.`
    : `You've used all ${limit} ${limit === 1 ? kind : plural} included in your plan. ` +
      `Ask your provider to assign more, or deactivate one you no longer use.`
}

// ── Public ticket tracking (QR on the printed ticket) ─────────
// Two questions, kept separate: has the distributor sold this (the grant a
// tenant cannot raise itself), and is it effectively on right now (that grant
// AND the school's own switch). /school/settings needs the first, to decide
// whether its toggle is even shown; the kiosk and the public page need only
// the second. Neither is react-cache'd, matching this file's other reads.
export async function getSchoolPublicTrackingGranted(customerId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('customers')
    .select('school_public_tracking_enabled')
    .eq('id', customerId)
    .maybeSingle()

  return (data as { school_public_tracking_enabled: boolean | null } | null)
    ?.school_public_tracking_enabled ?? false
}

export async function getSchoolPublicTrackingEnabled(
  customerId: string,
  branchId: string
): Promise<boolean> {
  const supabase = createSupabaseServiceClient()
  const [granted, { data: settings }] = await Promise.all([
    getSchoolPublicTrackingGranted(customerId),
    supabase
      .from('school_settings')
      .select('public_tracking_enabled')
      .eq('branch_id', branchId)
      .maybeSingle(),
  ])

  // No settings row yet still defaults to on, matching the column default —
  // nothing to configure before this works once granted.
  const toggledOn = (settings as { public_tracking_enabled: boolean | null } | null)
    ?.public_tracking_enabled ?? true

  return granted && toggledOn
}
