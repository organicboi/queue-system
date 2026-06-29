import 'server-only'
import { cache } from 'react'
import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toBranchDTO, type BranchDTO, type BranchDataPacket, type DbBranch,
} from '@/lib/db/types'

export const getBranches = cache(async (customerId: string): Promise<BranchDTO[]> => {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  return (data as DbBranch[] ?? []).map(toBranchDTO)
})

export const getBranch = cache(async (branchId: string, customerId: string): Promise<BranchDTO> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .eq('customer_id', customerId)
    .single()

  if (error || !data) throw new Error('Branch not found')
  return toBranchDTO(data as DbBranch)
})

export const getBranchByToken = cache(async (token: string): Promise<BranchDataPacket> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('get_branch_data', { p_branch_token: token })

  if (error || !data) return { status: 'not_configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packet = data as any
  return {
    status: packet.status ?? 'not_configured',
    branchId: packet.branchId,
    branchName: packet.branchName,
    branchToken: packet.branchToken,
    customerId: packet.customerId,
    businessName: packet.businessName,
    primaryColor: packet.primaryColor,
    logoUrl: packet.logoUrl,
    queueLabel: packet.queueLabel,
    allowSelfJoin: packet.allowSelfJoin,
    maxCapacity: packet.maxCapacity,
    avgServiceTime: packet.avgServiceTime,
    soundEnabled: packet.soundEnabled,
    silentPrint: packet.silentPrint,
    printerName: packet.printerName,
    tickerText: packet.tickerText,
    currentServingNumber: packet.currentServingNumber,
    isPaused: packet.isPaused,
    planName: packet.planName,
    allowAds: packet.allowAds,
    allowAnalytics: packet.allowAnalytics,
  }
})

export const getCustomerBranchStats = cache(async (customerId: string) => {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('customer_id', customerId)
    .eq('is_active', true)

  if (!branches?.length) return []

  const branchIds = branches.map(b => b.id)

  const [{ data: entries }, { data: states }, { data: screens }] = await Promise.all([
    supabase
      .from('queue_entries')
      .select('branch_id, status')
      .eq('customer_id', customerId)
      .in('branch_id', branchIds)
      .gte('created_at', `${today}T00:00:00`),
    supabase
      .from('queue_state')
      .select('branch_id, current_serving_number, is_paused')
      .eq('customer_id', customerId)
      .in('branch_id', branchIds),
    supabase
      .from('screens')
      .select('branch_id')
      .eq('customer_id', customerId)
      .in('branch_id', branchIds)
      .eq('is_active', true),
  ])

  return branches.map(b => {
    const bEntries = (entries ?? []).filter(e => e.branch_id === b.id)
    const state = (states ?? []).find(s => s.branch_id === b.id)
    const screensCount = (screens ?? []).filter(s => s.branch_id === b.id).length

    return {
      branchId: b.id,
      branchName: b.name,
      totalToday: bEntries.length,
      waiting: bEntries.filter(e => e.status === 'waiting').length,
      inProgress: bEntries.filter(e => e.status === 'in-progress').length,
      completed: bEntries.filter(e => e.status === 'completed').length,
      cancelled: bEntries.filter(e => e.status === 'cancelled').length,
      noShow: bEntries.filter(e => e.status === 'no-show').length,
      currentServingNumber: state?.current_serving_number ?? 0,
      isPaused: state?.is_paused ?? false,
      screensCount,
    }
  })
})
