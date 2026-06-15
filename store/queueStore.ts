"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { initialQueue, initialActivityLogs } from "@/lib/mockData"
import type { QueueEntry, ActivityLog, ServiceType, QueueType } from "@/lib/types"

interface QueueState {
  entries: QueueEntry[]
  currentServingNumber: number
  nextQueueNumber: number
  activityLogs: ActivityLog[]

  callNext: () => void
  callPrevious: () => void
  completeCurrentEntry: () => void
  addEntry: (data: {
    name: string
    phone: string
    email: string
    service: ServiceType
    type: QueueType
  }) => QueueEntry
  cancelEntry: (queueNumber: number) => void
  getEntryByToken: (token: string) => QueueEntry | undefined
  getPositionInQueue: (queueNumber: number) => number
  resetToDefaults: () => void
}

function makeLog(
  type: ActivityLog["type"],
  queueNumber: number,
  message: string
): ActivityLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type,
    queueNumber,
    message,
  }
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      entries: initialQueue,
      currentServingNumber: 18,
      nextQueueNumber: 29,
      activityLogs: initialActivityLogs,

      callNext: () => {
        const { entries, currentServingNumber } = get()
        const currentEntry = entries.find(
          (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
        )
        const nextWaiting = entries
          .filter((e) => e.status === "waiting")
          .sort((a, b) => a.queueNumber - b.queueNumber)[0]

        if (!nextWaiting) return

        const now = new Date().toISOString()
        set((s) => ({
          entries: s.entries.map((e) => {
            if (currentEntry && e.id === currentEntry.id) {
              return { ...e, status: "completed", completedAt: now }
            }
            if (e.id === nextWaiting.id) {
              return { ...e, status: "in-progress", startedAt: now }
            }
            return e
          }),
          currentServingNumber: nextWaiting.queueNumber,
          activityLogs: [
            makeLog("called", nextWaiting.queueNumber, `Queue #${nextWaiting.queueNumber} called`),
            ...(currentEntry
              ? [makeLog("completed", currentEntry.queueNumber, `Queue #${currentEntry.queueNumber} completed`)]
              : []),
            ...s.activityLogs,
          ].slice(0, 50),
        }))
      },

      callPrevious: () => {
        const { entries, currentServingNumber } = get()
        const currentEntry = entries.find(
          (e) => e.queueNumber === currentServingNumber && e.status === "in-progress"
        )
        const prevCompleted = entries
          .filter((e) => e.status === "completed" && e.queueNumber < currentServingNumber)
          .sort((a, b) => b.queueNumber - a.queueNumber)[0]

        if (!prevCompleted) return

        const now = new Date().toISOString()
        set((s) => ({
          entries: s.entries.map((e) => {
            if (currentEntry && e.id === currentEntry.id) {
              return { ...e, status: "waiting", startedAt: undefined }
            }
            if (e.id === prevCompleted.id) {
              return { ...e, status: "in-progress", startedAt: now, completedAt: undefined }
            }
            return e
          }),
          currentServingNumber: prevCompleted.queueNumber,
          activityLogs: [
            makeLog("called", prevCompleted.queueNumber, `Queue #${prevCompleted.queueNumber} recalled`),
            ...s.activityLogs,
          ].slice(0, 50),
        }))
      },

      completeCurrentEntry: () => {
        get().callNext()
      },

      addEntry: (data) => {
        const { nextQueueNumber } = get()
        const queueNumber = nextQueueNumber
        const token = `Q-${queueNumber}`
        const now = new Date().toISOString()

        const newEntry: QueueEntry = {
          id: `entry-${queueNumber}`,
          queueNumber,
          name: data.name,
          phone: data.phone,
          email: data.email,
          service: data.service,
          type: data.type,
          status: "waiting",
          joinedAt: now,
          trackingToken: token,
        }

        set((s) => ({
          entries: [...s.entries, newEntry],
          nextQueueNumber: queueNumber + 1,
          activityLogs: [
            makeLog("joined", queueNumber, `Queue #${queueNumber} joined (${data.name})`),
            ...s.activityLogs,
          ].slice(0, 50),
        }))

        return newEntry
      },

      cancelEntry: (queueNumber) => {
        const { entries, currentServingNumber } = get()
        const entry = entries.find((e) => e.queueNumber === queueNumber)
        if (!entry) return

        const wasInProgress = entry.status === "in-progress"

        set((s) => ({
          entries: s.entries.map((e) =>
            e.queueNumber === queueNumber ? { ...e, status: "cancelled" } : e
          ),
          activityLogs: [
            makeLog("cancelled", queueNumber, `Queue #${queueNumber} cancelled`),
            ...s.activityLogs,
          ].slice(0, 50),
        }))

        if (wasInProgress) {
          get().callNext()
        }
      },

      getEntryByToken: (token) => {
        return get().entries.find((e) => e.trackingToken === token)
      },

      getPositionInQueue: (queueNumber) => {
        const { entries } = get()
        return entries.filter(
          (e) => e.status === "waiting" && e.queueNumber < queueNumber
        ).length
      },

      resetToDefaults: () => {
        set({
          entries: initialQueue,
          currentServingNumber: 18,
          nextQueueNumber: 29,
          activityLogs: initialActivityLogs,
        })
      },
    }),
    {
      name: "techbizqueue-queue-state",
      partialize: (state) => ({
        entries: state.entries,
        currentServingNumber: state.currentServingNumber,
        nextQueueNumber: state.nextQueueNumber,
        activityLogs: state.activityLogs,
      }),
    }
  )
)

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "techbizqueue-queue-state") {
      useQueueStore.persist.rehydrate()
    }
  })
}
