export type QueueStatus = "waiting" | "in-progress" | "completed" | "cancelled"
export type QueueType = "normal" | "priority" | "vip"
export type ServiceType =
  | "Food Order"
  | "Consultation"
  | "Repair Service"
  | "Document Verification"

export interface QueueEntry {
  id: string
  queueNumber: number
  name: string
  phone: string
  email: string
  service: ServiceType
  type: QueueType
  status: QueueStatus
  joinedAt: string
  startedAt?: string
  completedAt?: string
  trackingToken: string
  estimatedWait?: number
}

export interface ActivityLog {
  id: string
  timestamp: string
  message: string
  type: "completed" | "called" | "joined" | "cancelled"
  queueNumber: number
}
