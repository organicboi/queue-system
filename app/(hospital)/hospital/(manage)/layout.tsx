import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalSettings } from '@/lib/dal/hospital'
import { HospitalSidebar } from '@/components/hospital/HospitalSidebar'
import { HospitalTopBar } from '@/components/hospital/HospitalTopBar'
import { pickLocale, defaultLocale } from '@/lib/region'

export default async function HospitalManageLayout({ children }: { children: React.ReactNode }) {
  const { profile, branches, branch } = await requireHospitalContext()
  const settings = await getHospitalSettings(branch.id)
  const hospitalName =
    pickLocale(settings?.hospitalName, defaultLocale()) || profile.businessName || 'Hospital Queue'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden w-60 shrink-0 border-e border-slate-200 md:flex md:flex-col">
        <HospitalSidebar hospitalName={hospitalName} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <HospitalTopBar branches={branches} activeBranchId={branch.id} hospitalName={hospitalName} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
