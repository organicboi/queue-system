'use client'

import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/db/browser'
import type { QueueEntryDTO, DbQueueEntry, DbQueueState } from '@/lib/db/types'
import { toQueueEntryDTO } from '@/lib/db/types'

interface State {
  entries: QueueEntryDTO[]
  currentServingNumber: number
  isPaused: boolean
  isLoading: boolean
}

export function useSupabaseQueue(branchId: string) {
  const [state, setState] = useState<State>({
    entries: [],
    currentServingNumber: 0,
    isPaused: false,
    isLoading: true,
  })

  const ref = useRef(state)
  ref.current = state

  useEffect(() => {
    if (!branchId) return
    const supabase = createSupabaseBrowserClient()
    let alive = true

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

    load()

    const channel = supabase
      .channel(`queue-display-${branchId}`)
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
