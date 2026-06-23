"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { QueueEntry, QueueStatus } from "@/lib/types"

interface State {
  entries: QueueEntry[]
  currentServingNumber: number
  nextQueueNumber: number
  isLoading: boolean
}

type DbRow = {
  id: string
  queue_number: number
  bill_number: string
  status: string
  joined_at: string
  started_at?: string | null
  completed_at?: string | null
  call_count?: number | null
}

function toEntry(row: DbRow): QueueEntry {
  return {
    id: row.id,
    queueNumber: row.queue_number,
    billNumber: row.bill_number,
    status: row.status as QueueStatus,
    joinedAt: row.joined_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    callCount: row.call_count ?? 0,
  }
}

export function useSupabaseQueue() {
  const [state, setState] = useState<State>({
    entries: [],
    currentServingNumber: 0,
    nextQueueNumber: 1,
    isLoading: true,
  })

  // Always-fresh ref so async callbacks don't close over stale state
  const ref = useRef(state)
  ref.current = state

  useEffect(() => {
    let alive = true

    async function load() {
      const [{ data: qs }, { data: rows }] = await Promise.all([
        supabase.from("queue_state").select("*").eq("id", 1).single(),
        supabase.from("queue_entries").select("*").order("queue_number"),
      ])
      if (!alive) return
      setState({
        entries: ((rows as DbRow[]) ?? []).map(toEntry),
        currentServingNumber: qs?.current_serving_number ?? 0,
        nextQueueNumber: qs?.next_queue_number ?? 1,
        isLoading: false,
      })
    }

    load()

    const channel = supabase
      .channel("queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        (payload) => {
          if (!alive) return
          setState((prev) => {
            if (payload.eventType === "INSERT") {
              const entry = toEntry(payload.new as DbRow)
              if (prev.entries.some((e) => e.id === entry.id)) return prev
              return {
                ...prev,
                entries: [...prev.entries, entry].sort(
                  (a, b) => a.queueNumber - b.queueNumber
                ),
              }
            }
            if (payload.eventType === "UPDATE") {
              return {
                ...prev,
                entries: prev.entries.map((e) =>
                  e.id === payload.new.id ? toEntry(payload.new as DbRow) : e
                ),
              }
            }
            if (payload.eventType === "DELETE") {
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
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue_state" },
        (payload) => {
          if (!alive) return
          setState((prev) => ({
            ...prev,
            currentServingNumber: payload.new.current_serving_number,
            nextQueueNumber: payload.new.next_queue_number,
          }))
        }
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [])

  const addEntry = useCallback(async (billNumber: string): Promise<QueueEntry> => {
    const queueNumber = ref.current.nextQueueNumber
    const now = new Date().toISOString()

    // Optimistically bump nextQueueNumber so back-to-back adds don't collide
    setState((prev) => ({ ...prev, nextQueueNumber: prev.nextQueueNumber + 1 }))

    const newEntry: QueueEntry = {
      id: `entry-${queueNumber}`,
      queueNumber,
      billNumber,
      status: "waiting",
      joinedAt: now,
    }

    await Promise.all([
      supabase.from("queue_entries").insert({
        id: newEntry.id,
        queue_number: queueNumber,
        bill_number: billNumber,
        status: "waiting",
        joined_at: now,
        call_count: 0,
      }),
      supabase
        .from("queue_state")
        .update({ next_queue_number: queueNumber + 1, updated_at: now })
        .eq("id", 1),
    ])

    return newEntry
  }, [])

  const callNext = useCallback(async () => {
    const { entries, currentServingNumber } = ref.current
    const current = entries.find(
      (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
    )
    const next = entries
      .filter((e) => e.status === "waiting")
      .sort((a, b) => a.queueNumber - b.queueNumber)[0]

    if (!next) return
    const now = new Date().toISOString()

    await Promise.all([
      supabase
        .from("queue_entries")
        .update({ status: "in-progress", started_at: now })
        .eq("id", next.id),
      supabase
        .from("queue_state")
        .update({ current_serving_number: next.queueNumber, updated_at: now })
        .eq("id", 1),
      ...(current
        ? [
            supabase
              .from("queue_entries")
              .update({ status: "completed", completed_at: now })
              .eq("id", current.id),
          ]
        : []),
    ])
  }, [])

  const callPrevious = useCallback(async () => {
    const { entries, currentServingNumber } = ref.current
    const current = entries.find(
      (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
    )
    const prev = entries
      .filter(
        (e) => e.status === "completed" && e.queueNumber < currentServingNumber
      )
      .sort((a, b) => b.queueNumber - a.queueNumber)[0]

    if (!prev) return
    const now = new Date().toISOString()

    await Promise.all([
      supabase
        .from("queue_entries")
        .update({ status: "in-progress", started_at: now, completed_at: null })
        .eq("id", prev.id),
      supabase
        .from("queue_state")
        .update({ current_serving_number: prev.queueNumber, updated_at: now })
        .eq("id", 1),
      ...(current
        ? [
            supabase
              .from("queue_entries")
              .update({ status: "waiting", started_at: null })
              .eq("id", current.id),
          ]
        : []),
    ])
  }, [])

  const completeCurrentEntry = useCallback(() => callNext(), [callNext])

  const markEntryCompleted = useCallback(
    async (queueNumber: number) => {
      const entry = ref.current.entries.find((e) => e.queueNumber === queueNumber)
      if (!entry || entry.status === "completed" || entry.status === "cancelled") return

      const wasInProgress = entry.status === "in-progress"
      const now = new Date().toISOString()

      await supabase
        .from("queue_entries")
        .update({ status: "completed", completed_at: now })
        .eq("id", entry.id)

      if (wasInProgress) await callNext()
    },
    [callNext]
  )

  const callEntry = useCallback(async (queueNumber: number) => {
    const entry = ref.current.entries.find((e) => e.queueNumber === queueNumber)
    if (!entry) return
    const newCount = (entry.callCount ?? 0) + 1

    await supabase
      .from("queue_entries")
      .update({ call_count: newCount })
      .eq("queue_number", queueNumber)

    supabase.channel("queue-display-signals").send({
      type: "broadcast",
      event: "customer-called",
      payload: { queueNumber, billNumber: entry.billNumber, callCount: newCount },
    })
  }, [])

  return {
    entries: state.entries,
    currentServingNumber: state.currentServingNumber,
    isLoading: state.isLoading,
    addEntry,
    callNext,
    callPrevious,
    completeCurrentEntry,
    markEntryCompleted,
    callEntry,
  }
}
