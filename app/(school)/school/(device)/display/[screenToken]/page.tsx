import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import { getSchoolBoard } from '@/lib/dal/school'
import { SchoolBoard } from '@/components/school/SchoolBoard'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ screenToken: string }>
}

export default async function SchoolDisplayPage({ params }: Props) {
  const { screenToken } = await params
  const initial = await getSchoolBoard(screenToken)
  if (initial.status === 'not-found') notFound()

  return <SchoolBoard screenToken={screenToken} initial={initial} />
}
