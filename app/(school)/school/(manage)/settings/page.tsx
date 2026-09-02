import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolSettings } from '@/lib/dal/school'
import { getSchoolPublicTrackingGranted } from '@/lib/dal/school-limits'
import { SchoolSettingsForm } from '@/components/school/SchoolSettingsForm'

export const dynamic = 'force-dynamic'

export default async function SchoolSettingsPage() {
  const { profile, branch } = await requireSchoolContext()
  const [settings, publicTrackingGranted] = await Promise.all([
    getSchoolSettings(branch.id),
    getSchoolPublicTrackingGranted(profile.customerId),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>
      <SchoolSettingsForm
        branchId={branch.id}
        settings={settings}
        fallbackName={profile.businessName ?? branch.name}
        publicTrackingGranted={publicTrackingGranted}
      />
    </div>
  )
}
