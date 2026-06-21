import type { QueueEntry, ActivityLog } from "./types"

const now = new Date()
const mins = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString()

export const initialQueue: QueueEntry[] = [
  { id: "entry-12", queueNumber: 12, billNumber: "B-1001", status: "completed", joinedAt: mins(180), startedAt: mins(165), completedAt: mins(150) },
  { id: "entry-13", queueNumber: 13, billNumber: "B-1002", status: "completed", joinedAt: mins(165), startedAt: mins(148), completedAt: mins(133) },
  { id: "entry-14", queueNumber: 14, billNumber: "B-1003", status: "completed", joinedAt: mins(150), startedAt: mins(132), completedAt: mins(117) },
  { id: "entry-15", queueNumber: 15, billNumber: "B-1004", status: "completed", joinedAt: mins(135), startedAt: mins(116), completedAt: mins(99) },
  { id: "entry-16", queueNumber: 16, billNumber: "B-1005", status: "completed", joinedAt: mins(110), startedAt: mins(98), completedAt: mins(82) },
  { id: "entry-17", queueNumber: 17, billNumber: "B-1006", status: "completed", joinedAt: mins(90), startedAt: mins(81), completedAt: mins(65) },
  { id: "entry-18", queueNumber: 18, billNumber: "B-1007", status: "in-progress", joinedAt: mins(70), startedAt: mins(5) },
  { id: "entry-19", queueNumber: 19, billNumber: "B-1008", status: "waiting", joinedAt: mins(60) },
  { id: "entry-20", queueNumber: 20, billNumber: "B-1009", status: "waiting", joinedAt: mins(55) },
  { id: "entry-21", queueNumber: 21, billNumber: "B-1010", status: "waiting", joinedAt: mins(48) },
  { id: "entry-22", queueNumber: 22, billNumber: "B-1011", status: "waiting", joinedAt: mins(42) },
  { id: "entry-23", queueNumber: 23, billNumber: "B-1012", status: "waiting", joinedAt: mins(36) },
  { id: "entry-24", queueNumber: 24, billNumber: "B-1013", status: "waiting", joinedAt: mins(30) },
  { id: "entry-25", queueNumber: 25, billNumber: "B-1014", status: "waiting", joinedAt: mins(25) },
  { id: "entry-26", queueNumber: 26, billNumber: "B-1015", status: "waiting", joinedAt: mins(20) },
  { id: "entry-27", queueNumber: 27, billNumber: "B-1016", status: "waiting", joinedAt: mins(15) },
  { id: "entry-28", queueNumber: 28, billNumber: "B-1017", status: "waiting", joinedAt: mins(8) },
]

export const initialActivityLogs: ActivityLog[] = [
  { id: "log-1", timestamp: mins(65), message: "Queue #17 completed", type: "completed", queueNumber: 17 },
  { id: "log-2", timestamp: mins(5), message: "Queue #18 called", type: "called", queueNumber: 18 },
  { id: "log-3", timestamp: mins(8), message: "Queue #28 — Bill B-1017", type: "joined", queueNumber: 28 },
  { id: "log-4", timestamp: mins(15), message: "Queue #27 — Bill B-1016", type: "joined", queueNumber: 27 },
  { id: "log-5", timestamp: mins(20), message: "Queue #26 — Bill B-1015", type: "joined", queueNumber: 26 },
  { id: "log-6", timestamp: mins(25), message: "Queue #25 — Bill B-1014", type: "joined", queueNumber: 25 },
]
