import 'server-only'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  DEFAULT_HOSPITAL_DEPARTMENT_LIMIT,
  DEFAULT_HOSPITAL_ROOM_LIMIT,
} from '@/lib/db/types'
import type { HospitalQuota } from '@/lib/db/hospital-types'

// Departments and rooms are sold capacity: the distributor sets the ceiling
// on the customer row, the tenant spends it from /hospital/departments and
// /hospital/rooms. Counted per branch (matching plans.max_screens_per_branch)
// and over ACTIVE rows only — neither is ever hard-deleted, so deactivating is
// how a tenant frees a slot. Same rule as school-limits.ts.

export interface HospitalQuotas {
  departments: HospitalQuota
  rooms: HospitalQuota
}

// Deliberately not react-cache'd: a server action reads this immediately
// before inserting, and a stale count would hand out a slot twice.
async function readLimits(customerId: string): Promise<{ departments: number; rooms: number }> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('customers')
    .select('max_hospital_departments, max_hospital_rooms')
    .eq('id', customerId)
    .maybeSingle()

  const row = data as { max_hospital_departments: number | null; max_hospital_rooms: number | null } | null
  return {
    departments: row?.max_hospital_departments ?? DEFAULT_HOSPITAL_DEPARTMENT_LIMIT,
    rooms: row?.max_hospital_rooms ?? DEFAULT_HOSPITAL_ROOM_LIMIT,
  }
}

async function countActive(table: 'hospital_departments' | 'hospital_rooms', branchId: string): Promise<number> {
  const supabase = createSupabaseServiceClient()
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)
  return count ?? 0
}

function quota(limit: number, used: number): HospitalQuota {
  return { limit, used, remaining: Math.max(0, limit - used) }
}

export async function getHospitalDepartmentQuota(customerId: string, branchId: string): Promise<HospitalQuota> {
  const [limits, used] = await Promise.all([readLimits(customerId), countActive('hospital_departments', branchId)])
  return quota(limits.departments, used)
}

export async function getHospitalRoomQuota(customerId: string, branchId: string): Promise<HospitalQuota> {
  const [limits, used] = await Promise.all([readLimits(customerId), countActive('hospital_rooms', branchId)])
  return quota(limits.rooms, used)
}

export async function getHospitalQuotas(customerId: string, branchId: string): Promise<HospitalQuotas> {
  const [limits, departmentsUsed, roomsUsed] = await Promise.all([
    readLimits(customerId),
    countActive('hospital_departments', branchId),
    countActive('hospital_rooms', branchId),
  ])
  return {
    departments: quota(limits.departments, departmentsUsed),
    rooms: quota(limits.rooms, roomsUsed),
  }
}

// One wording for both, so the tenant always learns the same thing: the cap is
// not theirs to raise.
export function quotaReachedMessage(kind: 'department' | 'room', limit: number): string {
  const plural = kind === 'department' ? 'departments' : 'rooms'
  return limit === 0
    ? `No ${plural} are included in your plan. Ask your provider to assign some.`
    : `You've used all ${limit} ${limit === 1 ? kind : plural} included in your plan. ` +
      `Ask your provider to assign more, or deactivate one you no longer use.`
}

// ── Public ticket tracking (QR on the printed ticket) ─────────
// Same two-question split as school: the distributor grant on the customer
// row, and the effective on/off (grant AND the branch's own switch). A missing
// settings row defaults to on.
export async function getHospitalPublicTrackingGranted(customerId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('customers')
    .select('hospital_public_tracking_enabled')
    .eq('id', customerId)
    .maybeSingle()

  return (data as { hospital_public_tracking_enabled: boolean | null } | null)
    ?.hospital_public_tracking_enabled ?? true
}

export async function getHospitalPublicTrackingEnabled(
  customerId: string,
  branchId: string
): Promise<boolean> {
  const supabase = createSupabaseServiceClient()
  const [granted, { data: settings }] = await Promise.all([
    getHospitalPublicTrackingGranted(customerId),
    supabase
      .from('hospital_settings')
      .select('public_tracking_enabled')
      .eq('branch_id', branchId)
      .maybeSingle(),
  ])

  const toggledOn = (settings as { public_tracking_enabled: boolean | null } | null)
    ?.public_tracking_enabled ?? true

  return granted && toggledOn
}
