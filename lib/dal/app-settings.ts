import 'server-only'
import { getSchoolSettings } from '@/lib/dal/school'
import { getHospitalSettings } from '@/lib/dal/hospital'
import { regionLocales } from '@/lib/region'
import type { CustomerVertical } from '@/lib/db/types'
import type { SchoolSettingsDTO } from '@/lib/db/school-types'
import type { HospitalSettingsDTO } from '@/lib/db/hospital-types'

// Read side of the native-app tenant-settings screen. The write side dispatches
// to `saveSchoolSettingsAction` / `saveHospitalSettingsAction` (with a
// pre-authorized profile) straight from the route handler.

export interface TenantSettingsPayload {
  vertical: CustomerVertical
  settings: SchoolSettingsDTO | HospitalSettingsDTO | null
  availableLanguages: string[]
}

export async function readTenantSettings(
  vertical: CustomerVertical,
  branchId: string
): Promise<TenantSettingsPayload> {
  const availableLanguages = regionLocales()
  if (vertical === 'school') {
    return { vertical, settings: await getSchoolSettings(branchId), availableLanguages }
  }
  if (vertical === 'hospital') {
    return { vertical, settings: await getHospitalSettings(branchId), availableLanguages }
  }
  // The hotel/business product has no app-editable tenant settings in this scope.
  return { vertical, settings: null, availableLanguages }
}
