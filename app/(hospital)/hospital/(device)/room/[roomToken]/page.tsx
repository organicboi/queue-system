import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import { fetchHospitalRoomViewAction } from '@/lib/actions/hospital-read'
import { HospitalRoomConsole } from '@/components/hospital/HospitalRoomConsole'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ roomToken: string }>
}

export default async function HospitalRoomPage({ params }: Props) {
  const { roomToken } = await params
  const initial = await fetchHospitalRoomViewAction(roomToken)
  if (initial.status !== 'ok') notFound()

  return <HospitalRoomConsole roomToken={roomToken} initial={initial} />
}
