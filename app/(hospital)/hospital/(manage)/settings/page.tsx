import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalSettings } from '@/lib/dal/hospital'
import { getHospitalPublicTrackingGranted } from '@/lib/dal/hospital-limits'
import { HospitalSettingsForm } from '@/components/hospital/HospitalSettingsForm'

export const dynamic = 'force-dynamic'

export default async function HospitalSettingsPage() {
  const { profile, branch } = await requireHospitalContext()
  const [settings, publicTrackingGranted] = await Promise.all([
    getHospitalSettings(branch.id),
    getHospitalPublicTrackingGranted(profile.customerId),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>
      <HospitalSettingsForm
        branchId={branch.id}
        settings={settings}
        fallbackName={profile.businessName ?? branch.name}
        publicTrackingGranted={publicTrackingGranted}
      />
    </div>
  )
}
