'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { createSupabaseBrowserClient } from '@/lib/db/browser'
import { toQueueEntryDTO, type QueueEntryDTO, type DbQueueEntry, type DbQueueState } from '@/lib/db/types'

interface RealtimeQueueState {
  entries: QueueEntryDTO[]
  currentServingNumber: number
  isPaused: boolean
  isLoading: boolean
}

export function useRealtimeQueue(
  branchId: string,
  initial?: { entries: QueueEntryDTO[]; currentServingNumber: number; isPaused?: boolean }
) {
  const [state, setState] = useState<RealtimeQueueState>({
    entries: initial?.entries ?? [],
    currentServingNumber: initial?.currentServingNumber ?? 0,
    isPaused: initial?.isPaused ?? false,
    isLoading: !initial,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  // Unique per hook instance — prevents collisions when multiple components on
  // the same page call this hook with the same branchId (e.g. LiveQueuePanel
  // + QueueTable). Also incremented each StrictMode re-mount so the channel
  // name is always fresh and never already-subscribed.
  const instanceId = useId().replace(/:/g, '')
  const mountCount = useRef(0)

  useEffect(() => {
    if (!branchId) return
    const supabase = createSupabaseBrowserClient()
    let alive = true

    mountCount.current += 1
    const channelName = `queue-admin-${branchId}-${instanceId}-${mountCount.current}`

    async function load() {
      const [{ data: qs }, { data: rows }] = await Promise.all([
        supabase
          .from('queue_state')
          .select('current_serving_number, next_queue_number, is_paused')
          .eq('branch_id', branchId)
          .single(),
        supabase
          .from('queue_entries')
          .select('*')
          .eq('branch_id', branchId)
          .order('queue_number', { ascending: true }),
      ])

      if (!alive) return

      const stateRow = qs as DbQueueState | null
      setState({
        entries: ((rows ?? []) as DbQueueEntry[]).map(toQueueEntryDTO),
        currentServingNumber: stateRow?.current_serving_number ?? 0,
        isPaused: stateRow?.is_paused ?? false,
        isLoading: false,
      })
    }

    if (!initial) load()

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_entries', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (!alive) return
          setState((prev) => {
            if (payload.eventType === 'INSERT') {
              const entry = toQueueEntryDTO(payload.new as DbQueueEntry)
              if (prev.entries.some((e) => e.id === entry.id)) return prev
              return {
                ...prev,
                entries: [...prev.entries, entry].sort((a, b) => a.queueNumber - b.queueNumber),
              }
            }
            if (payload.eventType === 'UPDATE') {
              return {
                ...prev,
                entries: prev.entries.map((e) =>
                  e.id === payload.new.id ? toQueueEntryDTO(payload.new as DbQueueEntry) : e
                ),
              }
            }
            if (payload.eventType === 'DELETE') {
              return {
                ...prev,
                entries: prev.entries.filter((e) => e.id !== payload.old.id),
              }
            }
            return prev
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'queue_state', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (!alive) return
          const row = payload.new as DbQueueState
          setState((prev) => ({
            ...prev,
            currentServingNumber: row.current_serving_number,
            isPaused: row.is_paused ?? false,
          }))
        }
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [branchId])

  return state
}
