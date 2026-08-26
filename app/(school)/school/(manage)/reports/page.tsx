import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolDepartments, getSchoolTokensPage } from '@/lib/dal/school'
import { SchoolReports } from '@/components/school/SchoolReports'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ range?: string }>
}

function rangeStart(range: string): string {
  const now = new Date()
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 1
  const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return start.toISOString().slice(0, 10)
}

export default async function SchoolReportsPage({ searchParams }: Props) {
  const { range = '7d' } = await searchParams
  const { branch } = await requireSchoolContext()

  const [departments, page] = await Promise.all([
    getSchoolDepartments(branch.id),
    // Reports read the whole window at once; the page size is generous
    // because a school branch issues hundreds of tokens a day, not millions.
    getSchoolTokensPage(branch.id, { from: rangeStart(range) }, 1),
  ])

  return (
    <SchoolReports
      range={range}
      departments={departments}
      tokens={page.tokens}
      total={page.total}
    />
  )
}
