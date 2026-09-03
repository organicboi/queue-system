import { requireHospitalContext } from '@/lib/dal/hospital-context'
import { getHospitalReport, getHospitalServiceDate } from '@/lib/dal/hospital'
import { HospitalReports } from '@/components/hospital/HospitalReports'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>
}

function daysAgo(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default async function HospitalReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const { branch } = await requireHospitalContext()
  const today = await getHospitalServiceDate(branch.id)

  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today
  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : daysAgo(to, 6)

  const report = await getHospitalReport(branch.id, from, to)

  return <HospitalReports report={report} />
}
