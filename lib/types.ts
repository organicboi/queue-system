export type QueueStatus = "waiting" | "in-progress" | "completed" | "cancelled"

export interface QueueEntry {
  id: string
  queueNumber: number
  billNumber: string
  status: QueueStatus
  joinedAt: string
  startedAt?: string
  completedAt?: string
}

export interface ActivityLog {
  id: string
  timestamp: string
  message: string
  type: "completed" | "called" | "joined" | "cancelled"
  queueNumber: number
}
