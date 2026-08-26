import { requireSchoolContext } from '@/lib/dal/school-context'
import { getSchoolDepartments, getSchoolTokensPage } from '@/lib/dal/school'
import { SchoolTokenHistory } from '@/components/school/SchoolTokenHistory'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    page?: string; status?: string; departmentId?: string; search?: string
    from?: string; to?: string
  }>
}

export default async function SchoolTokensPage({ searchParams }: Props) {
  const params = await searchParams
  const { branch } = await requireSchoolContext()
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const filters = {
    status: params.status,
    departmentId: params.departmentId,
    search: params.search,
    from: params.from,
    to: params.to,
  }

  const [departments, result] = await Promise.all([
    getSchoolDepartments(branch.id),
    getSchoolTokensPage(branch.id, filters, page),
  ])

  return (
    <SchoolTokenHistory
      departments={departments}
      tokens={result.tokens}
      total={result.total}
      page={page}
      filters={filters}
    />
  )
}
