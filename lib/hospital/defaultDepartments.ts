import type { createSupabaseServiceClient } from '@/lib/db/server'
import type { LocaleMap } from '@/lib/region'

/// The standard OPD + service-point set every hospital branch starts with.
/// Carries its own translations so every kiosk language reads a real name on
/// day one — this is seed *content*, not a translation system: a hospital can
/// edit any of these values per locale in the manager, and every surface
/// renders whatever the row actually holds (`pickLocale(name, lang)`).
///
/// Single source of truth for two callers: `seedDefaultHospitalDepartments`
/// below (auto-run the moment a hospital branch is created) and
/// `seedHospitalDepartmentsAction` in lib/actions/hospital-admin.ts (the
/// manual "Seed defaults" button, which also backfills locales onto branches
/// that were seeded before those translations existed).
export const DEPARTMENT_TYPES = ['opd', 'lab', 'radiology', 'pharmacy', 'billing', 'triage'] as const

export const DEFAULT_DEPARTMENTS: {
  name: LocaleMap; prefix: string; type: (typeof DEPARTMENT_TYPES)[number]; icon: string; color: string
}[] = [
  { name: { en: 'Registration', hi: 'पंजीकरण', mr: 'नोंदणी', ar: 'التسجيل' }, prefix: 'R', type: 'triage', icon: 'UserPlus', color: '#4338CA' },
  { name: { en: 'General Medicine', hi: 'सामान्य चिकित्सा', mr: 'सामान्य वैद्यकशास्त्र', ar: 'الطب العام' }, prefix: 'GM', type: 'opd', icon: 'Stethoscope', color: '#0F766E' },
  { name: { en: 'Orthopaedics', hi: 'अस्थि रोग', mr: 'अस्थिरोग', ar: 'جراحة العظام' }, prefix: 'OR', type: 'opd', icon: 'Bone', color: '#B45309' },
  { name: { en: 'Paediatrics', hi: 'बाल रोग', mr: 'बालरोग', ar: 'طب الأطفال' }, prefix: 'PD', type: 'opd', icon: 'Baby', color: '#BE185D' },
  { name: { en: 'ENT', hi: 'कान, नाक, गला', mr: 'कान, नाक, घसा', ar: 'الأنف والأذن والحنجرة' }, prefix: 'EN', type: 'opd', icon: 'Ear', color: '#7C3AED' },
  { name: { en: 'Ophthalmology', hi: 'नेत्र रोग', mr: 'नेत्ररोग', ar: 'طب العيون' }, prefix: 'EY', type: 'opd', icon: 'Eye', color: '#0E7490' },
  { name: { en: 'Laboratory', hi: 'प्रयोगशाला', mr: 'प्रयोगशाळा', ar: 'المختبر' }, prefix: 'LB', type: 'lab', icon: 'Microscope', color: '#15803D' },
  { name: { en: 'Radiology', hi: 'रेडियोलॉजी', mr: 'रेडिऑलॉजी', ar: 'الأشعة' }, prefix: 'XR', type: 'radiology', icon: 'ScanLine', color: '#1D4ED8' },
  { name: { en: 'Pharmacy', hi: 'फार्मेसी', mr: 'फार्मसी', ar: 'الصيدلية' }, prefix: 'PH', type: 'pharmacy', icon: 'Pill', color: '#C2410C' },
  { name: { en: 'Billing', hi: 'बिलिंग', mr: 'बिलिंग', ar: 'الفواتير' }, prefix: 'BL', type: 'billing', icon: 'Receipt', color: '#475569' },
]

/// Inserts the full standard set for a brand-new hospital branch. Called at
/// branch-creation time (distributor sale and standalone onboarding) so a
/// hospital never goes live with an empty department list or English-only
/// names waiting on someone to remember to click "Seed defaults" — the gap
/// that left every existing branch untranslated until backfilled by hand.
///
/// Fresh branch ⇒ no existing rows to merge with or dedupe against, unlike
/// seedHospitalDepartmentsAction — a plain insert of the whole set.
export async function seedDefaultHospitalDepartments(
  service: ReturnType<typeof createSupabaseServiceClient>,
  { customerId, branchId }: { customerId: string; branchId: string }
): Promise<void> {
  const rows = DEFAULT_DEPARTMENTS.map((d, i) => ({
    customer_id: customerId,
    branch_id: branchId,
    name: d.name,
    prefix: d.prefix,
    type: d.type,
    color: d.color,
    icon: d.icon,
    display_order: i + 1,
  }))
  const { error } = await service.from('hospital_departments').insert(rows)
  if (error) {
    // Branch creation has already succeeded at this point — an admin can
    // still seed manually from /hospital/departments — so this is a log, not
    // a failure the caller should surface or roll back for.
    console.error('[seedDefaultHospitalDepartments] insert error:', error.message)
  }
}
