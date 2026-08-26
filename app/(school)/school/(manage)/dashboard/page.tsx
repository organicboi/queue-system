import { requireSchoolContext } from '@/lib/dal/school-context'
import {
  getSchoolDashboardStats, getSchoolCounters, getSchoolDepartments,
  getSchoolActivity, getSchoolServiceDate, getTodaySchoolTokens,
} from '@/lib/dal/school'
import { SchoolDashboard } from '@/components/school/SchoolDashboard'

export const dynamic = 'force-dynamic'

export default async function SchoolDashboardPage() {
  const { branch } = await requireSchoolContext()
  const [stats, counters, departments, activity, serviceDate, tokens] = await Promise.all([
    getSchoolDashboardStats(branch.id),
    getSchoolCounters(branch.id),
    getSchoolDepartments(branch.id, { activeOnly: true }),
    getSchoolActivity(branch.id, 20),
    getSchoolServiceDate(branch.id),
    getTodaySchoolTokens(branch.id),
  ])

  return (
    <SchoolDashboard
      branchName={branch.name}
      serviceDate={serviceDate}
      stats={stats}
      counters={counters}
      departments={departments}
      tokens={tokens}
      activity={activity}
      needsSetup={departments.length === 0 || counters.length === 0}
    />
  )
}
