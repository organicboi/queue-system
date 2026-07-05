import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toScreenDTO, toAdDTO, toTickerMessageDTO,
  type ScreenDTO, type ScreenDataPacket, type DbScreen, type DbAd, type DbTickerMessage,
} from '@/lib/db/types'

export const getScreens = cache(async (branchId: string, customerId: string): Promise<ScreenDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('screens')
    .select('*')
    .eq('branch_id', branchId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  return (data as DbScreen[] ?? []).map(toScreenDTO)
})

export const getScreenByToken = cache(async (token: string): Promise<ScreenDataPacket> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_screen_data', { p_screen_token: token })

  if (error || !data) return { status: 'not_configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packet = data as any
  if (packet.status !== 'ok') {
    return {
      status: packet.status,
      businessName: packet.businessName,
      primaryColor: packet.primaryColor,
      logoUrl: packet.logoUrl,
    }
  }

  // resolve_screen_settings returns snake_case keys via row_to_json — map to camelCase here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSettings = packet.settings as any

  return {
    status: 'ok',
    screenId: packet.screenId,
    screenName: packet.screenName,
    branchId: packet.branchId,
    branchName: packet.branchName,
    customerId: packet.customerId,
    businessName: packet.businessName,
    primaryColor: packet.primaryColor,
    secondaryColor: packet.secondaryColor,
    logoUrl: packet.logoUrl,
    queueLabel: packet.queueLabel,
    tickerText: packet.tickerText,
    currentServingNumber: packet.currentServingNumber,
    isPaused: packet.isPaused,
    entries: packet.entries ?? [],
    // get_screen_data returns ads/tickers as raw rows (snake_case columns
    // via Postgres row-to-json) — map to camelCase DTOs the UI expects.
    ads: ((packet.ads ?? []) as DbAd[]).map(toAdDTO),
    tickers: ((packet.tickers ?? []) as DbTickerMessage[]).map(toTickerMessageDTO),
    settings: rawSettings ? {
      layout: rawSettings.layout,
      theme: rawSettings.theme,
      showAds: rawSettings.show_ads,
      showTicker: rawSettings.show_ticker,
      showClock: rawSettings.show_clock,
      showEstimatedWait: rawSettings.show_estimated_wait,
      numbersToShow: rawSettings.numbers_to_show,
      orientation: rawSettings.orientation,
      announcementLang: rawSettings.announcement_lang ?? 'en',
    } : undefined,
    allowSelfJoin: packet.allowSelfJoin,
    planName: packet.planName,
  }
})
