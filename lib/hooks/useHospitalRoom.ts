'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchHospitalRoomViewAction, type HospitalRoomView,
} from '@/lib/actions/hospital-read'
import { hospitalRoomHeartbeatAction } from '@/lib/actions/hospital-tokens'

const POLL_MS = 6000
const HEARTBEAT_MS = 45000

// The room console has no realtime channel of its own — it drives the queue
// rather than watching it. A short poll keeps the waiting lane fresh (another
// room may have called a shared-department token) and doubles as recovery.
export function useHospitalRoom(roomToken: string, initial: HospitalRoomView) {
  const [view, setView] = useState(initial)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    const next = await fetchHospitalRoomViewAction(roomToken)
    if (next.status === 'ok') setView(next)
  }, [roomToken])

  // Let an action pause the poll while it runs so an in-flight optimistic
  // update is not clobbered by a mid-flight refresh.
  const withPause = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    busy.current = true
    try {
      return await fn()
    } finally {
      busy.current = false
      refresh()
    }
  }, [refresh])

  useEffect(() => {
    const poll = setInterval(refresh, POLL_MS)
    const beat = setInterval(() => { hospitalRoomHeartbeatAction(roomToken) }, HEARTBEAT_MS)
    hospitalRoomHeartbeatAction(roomToken)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(poll)
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, roomToken])

  return { view, setView, refresh, withPause }
}
