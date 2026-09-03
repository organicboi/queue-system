import { notFound, redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { getScreenByToken } from '@/lib/dal/screens'
import { TVDisplay } from '@/components/display/TVDisplay'
import { THEMES } from '@/components/display/displayThemes'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function DisplayPage({ params }: Props) {
  const { token } = await params

  // The Android TV shell (android-kiosk) hardcodes a /display URL, so a school
  // screen pointed at the old route lands here. Redirect rather than require
  // an APK rebuild on every installed device.
  const supabase = createSupabaseServiceClient()
  const { data: screen } = await supabase
    .from('screens')
    .select('kind')
    .eq('screen_token', token)
    .maybeSingle()
  const screenKind = (screen as { kind?: string } | null)?.kind
  if (screenKind === 'school') {
    redirect(`/school/display/${token}`)
  }
  if (screenKind === 'hospital') {
    redirect(`/hospital/display/${token}`)
  }

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
