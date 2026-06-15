"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { useQueueStore } from "@/store/queueStore"

export function StatusBreakdownChart() {
  const entries = useQueueStore((s) => s.entries)

  const data = [
    { name: "Completed", value: entries.filter((e) => e.status === "completed").length, fill: "#10b981" },
    { name: "In Progress", value: entries.filter((e) => e.status === "in-progress").length, fill: "#3b82f6" },
    { name: "Waiting", value: entries.filter((e) => e.status === "waiting").length, fill: "#64748b" },
    { name: "Cancelled", value: entries.filter((e) => e.status === "cancelled").length, fill: "#ef4444" },
  ].filter((d) => d.value > 0)

  return (
    <div className="bg-white border border-border rounded-md p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Queue Status Breakdown</h3>
        <p className="text-xs text-muted-foreground">Real-time distribution of queue statuses</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid hsl(215 20% 88%)",
              borderRadius: "4px",
              fontSize: "12px",
              color: "hsl(222 47% 11%)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "hsl(215 16% 47%)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
