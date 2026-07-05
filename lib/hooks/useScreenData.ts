'use client'

import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/db/browser'
import type { ScreenDataPacket, DbQueueState, DbQueueEntry, DbAd, DbTickerMessage } from '@/lib/db/types'
import { toQueueEntryDTO, toAdDTO, toTickerMessageDTO } from '@/lib/db/types'

interface ScreenDataState {
  packet: ScreenDataPacket | null
  currentServingNumber: number
  waitingEntries: ReturnType<typeof toQueueEntryDTO>[]
  isLoading: boolean
  error: string | null
}

export function useScreenData(screenToken: string, initialPacket?: ScreenDataPacket) {
  const [state, setState] = useState<ScreenDataState>({
    packet: initialPacket ?? null,
    currentServingNumber: initialPacket?.currentServingNumber ?? 0,
    waitingEntries: [],
    isLoading: !initialPacket,
    error: null,
  })

  const mountCount = useRef(0)

  useEffect(() => {
    if (!screenToken) return

    const supabase = createSupabaseBrowserClient()
    let alive = true

    mountCount.current += 1
    const channelName = `screen-${screenToken}-${mountCount.current}`

    async function load() {
      const { data, error } = await supabase.rpc('get_screen_data', { p_screen_token: screenToken })
      if (!alive) return
      if (error || !data) {
        setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load screen data' }))
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any
      // get_screen_data returns ads/tickers as raw rows (snake_case columns
      // via Postgres row-to-json) — map to camelCase DTOs the UI expects.
      const packet: ScreenDataPacket = {
        ...raw,
        ads: ((raw.ads ?? []) as DbAd[]).map(toAdDTO),
        tickers: ((raw.tickers ?? []) as DbTickerMessage[]).map(toTickerMessageDTO),
      }
      setState(prev => ({
        ...prev,
        packet,
        currentServingNumber: packet.currentServingNumber ?? 0,
        isLoading: false,
        error: null,
      }))
    }

    if (!initialPacket) load()

    const branchId = initialPacket?.branchId
    if (!branchId) return

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'queue_state', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (!alive) return
          const row = payload.new as DbQueueState
          setState(prev => ({
            ...prev,
            currentServingNumber: row.current_serving_number,
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_entries', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (!alive) return
          setState(prev => {
            let updated = [...prev.waitingEntries]
            if (payload.eventType === 'INSERT') {
              const entry = toQueueEntryDTO(payload.new as DbQueueEntry)
              if (entry.status === 'waiting' && !updated.some(e => e.id === entry.id)) {
                updated = [...updated, entry].sort((a, b) => a.queueNumber - b.queueNumber)
              }
            } else if (payload.eventType === 'UPDATE') {
              const entry = toQueueEntryDTO(payload.new as DbQueueEntry)
              updated = updated
                .map(e => e.id === entry.id ? entry : e)
                .filter(e => e.status === 'waiting')
            } else if (payload.eventType === 'DELETE') {
              updated = updated.filter(e => e.id !== payload.old.id)
            }
            return { ...prev, waitingEntries: updated }
          })
        }
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [screenToken])

  return state
}
