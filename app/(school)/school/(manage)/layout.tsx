import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolSettings } from '@/lib/dal/school'
import { SchoolSidebar } from '@/components/school/SchoolSidebar'
import { SchoolTopBar } from '@/components/school/SchoolTopBar'

export default async function SchoolManageLayout({ children }: { children: React.ReactNode }) {
  const { profile, branches, branch } = await requireSchoolContext()
  const settings = await getSchoolSettings(branch.id)
  const schoolName = settings?.schoolNameEn || profile.businessName || 'School Queue'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden w-60 shrink-0 border-e border-slate-200 md:flex md:flex-col">
        <SchoolSidebar schoolName={schoolName} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <SchoolTopBar branches={branches} activeBranchId={branch.id} schoolName={schoolName} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
