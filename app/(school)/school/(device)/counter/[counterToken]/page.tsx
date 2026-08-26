import { notFound } from 'next/navigation'
import type { Viewport } from 'next'
import { fetchSchoolCounterViewAction } from '@/lib/actions/school-read'
import { SchoolCounterConsole } from '@/components/school/SchoolCounterConsole'

export const dynamic = 'force-dynamic'

// Dedicated staff terminal: lock zoom so fast repeated taps never trigger
// accidental pinch/double-tap zoom.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

interface Props {
  params: Promise<{ counterToken: string }>
}

export default async function SchoolCounterPage({ params }: Props) {
  const { counterToken } = await params
  const initial = await fetchSchoolCounterViewAction(counterToken)
  if (initial.status !== 'ok') notFound()

  return <SchoolCounterConsole counterToken={counterToken} initial={initial} />
}
