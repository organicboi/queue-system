'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/db/browser'
import { fetchHospitalBoardAction } from '@/lib/actions/hospital-read'
import type { HospitalBoardPacket } from '@/lib/db/hospital-types'
import type { HospitalCallSignal } from '@/lib/actions/hospital-tokens'

export interface HospitalBoardCallEvent extends HospitalCallSignal {
  key: number
}

const POLL_MS = 8000

export function useHospitalBoard(screenToken: string, initial: HospitalBoardPacket) {
  const [packet, setPacket] = useState(initial)
  const [lastCall, setLastCall] = useState<HospitalBoardCallEvent | null>(null)
  const callKey = useRef(0)

  const refresh = useCallback(async () => {
    const next = await fetchHospitalBoardAction(screenToken)
    // A transient failure must not blank a wall-mounted board.
    if (next.status === 'ok' || next.status === 'expired') setPacket(next)
  }, [screenToken])

  // State of record + the recovery path a ceiling-mounted TV in a
  // power-cut-prone building needs (nobody is there to reload it).
  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const branchId = packet.branchId
  useEffect(() => {
    if (!branchId) return
    const supabase = createSupabaseBrowserClient()

    const bump = (payload: HospitalCallSignal) => {
      if (!payload?.tokenCode) { refresh(); return }
      callKey.current += 1
      setLastCall({ ...payload, key: callKey.current })
      refresh()
    }

    const channel = supabase
      .channel(`hospital-display-${branchId}`)
      .on('broadcast', { event: 'token-called' }, ({ payload }) => bump(payload as HospitalCallSignal))
      .on('broadcast', { event: 'token-recalled' }, ({ payload }) => bump(payload as HospitalCallSignal))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })

    return () => { supabase.removeChannel(channel) }
  }, [branchId, refresh])

  return { packet, lastCall }
}
