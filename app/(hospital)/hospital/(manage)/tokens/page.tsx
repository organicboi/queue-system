import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalDepartments, getHospitalTokensPage } from '@/lib/dal/hospital'
import { HospitalTokenHistory } from '@/components/hospital/HospitalTokenHistory'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    page?: string; status?: string; departmentId?: string; search?: string
    from?: string; to?: string
  }>
}

export default async function HospitalTokensPage({ searchParams }: Props) {
  const params = await searchParams
  const { branch } = await requireHospitalContext()
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const filters = {
    status: params.status,
    departmentId: params.departmentId,
    search: params.search,
    from: params.from,
    to: params.to,
  }

  const [departments, result] = await Promise.all([
    getHospitalDepartments(branch.id),
    getHospitalTokensPage(branch.id, filters, page),
  ])

  return (
    <HospitalTokenHistory
      departments={departments}
      tokens={result.tokens}
      total={result.total}
      page={page}
      filters={filters}
    />
  )
}
