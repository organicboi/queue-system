import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import { getHospitalBoard } from '@/lib/dal/hospital'
import { HospitalBoard } from '@/components/hospital/HospitalBoard'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ screenToken: string }>
}

export default async function HospitalDisplayPage({ params }: Props) {
  const { screenToken } = await params
  const initial = await getHospitalBoard(screenToken)
  if (initial.status === 'not-found') notFound()

  return <HospitalBoard screenToken={screenToken} initial={initial} />
}
