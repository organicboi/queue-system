'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/db/browser'
import { counterHeartbeatAction } from '@/lib/actions/counters'
import type { CounterPresenceEntry } from '@/lib/db/types'

const HEARTBEAT_INTERVAL_MS = 20_000
const PRESENCE_POLL_MS = 15_000
const TICK_MS = 5_000

// A counter counts as online if it has pinged within 2x the heartbeat
// interval plus a buffer for network/tab-throttling jitter.
export const COUNTER_OFFLINE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2 + 15_000

export function isCounterOnline(lastSeenAt: string | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false
  return now - new Date(lastSeenAt).getTime() < COUNTER_OFFLINE_THRESHOLD_MS
}

// Reports this counter page as "open right now" while mounted. Gated behind
// the branch's counterPresenceEnabled setting — no point writing heartbeats
// nobody reads.
export function useCounterHeartbeat(counterToken: string, enabled = true) {
  useEffect(() => {
    if (!counterToken || !enabled) return
    let alive = true

    function ping() {
      counterHeartbeatAction(counterToken).catch(() => { /* non-critical */ })
    }

    ping()
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      void alive
    }
  }, [counterToken])
}

// Polls the token-free presence RPC for every counter in the branch, so a
// counter page can show whether its sibling counters are staffed right now.
// Disabled by default (see counterPresenceEnabled on branches) — pass
// enabled=true once the branch has opted into the feature.
export function useCounterPresence(branchId: string, enabled = true) {
  const [counters, setCounters] = useState<CounterPresenceEntry[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!branchId || !enabled) return
    const supabase = createSupabaseBrowserClient()
    let alive = true

    async function load() {
      const { data } = await supabase.rpc('get_branch_counter_presence', { p_branch_id: branchId })
      if (!alive || !data) return
      const rows = data as { id: string; name: string; type: CounterPresenceEntry['type']; is_active: boolean; last_seen_at: string | null }[]
      setCounters(rows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        isActive: r.is_active,
        lastSeenAt: r.last_seen_at,
      })))
    }

    load()
    const interval = setInterval(load, PRESENCE_POLL_MS)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [branchId])

  // Re-derive online/offline between polls so a stalled heartbeat flips
  // the status even without new data arriving.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [])

  return counters.map(c => ({ ...c, isOnline: c.isActive && isCounterOnline(c.lastSeenAt, now) }))
}
