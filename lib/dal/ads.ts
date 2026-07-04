import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toAdDTO, toTickerMessageDTO,
  type AdDTO, type TickerMessageDTO, type DbAd, type DbTickerMessage,
} from '@/lib/db/types'

// Ads/tickers scoped to one branch (not the customer-wide "common" ones).
export const getAds = cache(async (customerId: string, branchId: string): Promise<AdDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('ads')
    .select('*')
    .eq('customer_id', customerId)
    .eq('branch_id', branchId)
    .order('display_order', { ascending: true })

  return (data as DbAd[] ?? []).map(toAdDTO)
})

export const getTickers = cache(async (customerId: string, branchId: string): Promise<TickerMessageDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('ticker_messages')
    .select('*')
    .eq('customer_id', customerId)
    .eq('branch_id', branchId)
    .order('display_order', { ascending: true })

  return (data as DbTickerMessage[] ?? []).map(toTickerMessageDTO)
})

// Customer-wide ads (branch_id IS NULL) — visible on every branch's screens
// unless a screen has its own explicit picks in screen_ads.
export const getCommonAds = cache(async (customerId: string): Promise<AdDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('ads')
    .select('*')
    .eq('customer_id', customerId)
    .is('branch_id', null)
    .order('display_order', { ascending: true })

  return (data as DbAd[] ?? []).map(toAdDTO)
})

// Everything a screen in this branch could show: common + branch-specific,
// active only. Used to populate the per-screen ad picker.
export const getAvailableAdsForBranch = cache(async (customerId: string, branchId: string): Promise<AdDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('ads')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order('display_order', { ascending: true })

  return (data as DbAd[] ?? []).map(toAdDTO)
})

// One query for every screen in a branch → its explicitly-picked ad ids
// (ordered), so the picker UI can pre-check the right boxes per screen.
export const getScreenAdsMap = cache(async (branchId: string): Promise<Record<string, string[]>> => {
  const supabase = createSupabaseServiceClient()
  const { data: screens } = await supabase.from('screens').select('id').eq('branch_id', branchId)
  const screenIds = (screens ?? []).map((s) => s.id as string)
  if (screenIds.length === 0) return {}

  const { data } = await supabase
    .from('screen_ads')
    .select('screen_id, ad_id, display_order')
    .in('screen_id', screenIds)
    .order('display_order', { ascending: true })

  const map: Record<string, string[]> = {}
  for (const row of (data ?? []) as { screen_id: string; ad_id: string }[]) {
    if (!map[row.screen_id]) map[row.screen_id] = []
    map[row.screen_id].push(row.ad_id)
  }
  return map
})
