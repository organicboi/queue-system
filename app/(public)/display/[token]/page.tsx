import { notFound } from 'next/navigation'
import { getScreenByToken } from '@/lib/dal/screens'
import { TVDisplay } from '@/components/display/TVDisplay'
import { THEMES } from '@/components/display/displayThemes'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function DisplayPage({ params }: Props) {
  const { token } = await params
  const packet = await getScreenByToken(token)

  if (!packet || packet.status !== 'ok' || !packet.branchId) notFound()

  const theme = THEMES[packet.settings?.theme ?? 'standard'] ?? THEMES.standard

  return (
    <TVDisplay
      theme={theme}
      businessName={packet.businessName ?? 'Queue System'}
      businessType=""
      tickerText={packet.tickerText ?? undefined}
      branchId={packet.branchId}
      announcementLang={packet.settings?.announcementLang ?? 'en'}
      ads={packet.ads}
      tickers={packet.tickers}
    />
  )
}
