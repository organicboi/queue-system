"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
const weeklyTrendData = [
  { day: "Mon", completed: 38, joined: 42 }, { day: "Tue", completed: 45, joined: 48 },
  { day: "Wed", completed: 52, joined: 55 }, { day: "Thu", completed: 61, joined: 65 },
  { day: "Fri", completed: 73, joined: 78 }, { day: "Sat", completed: 89, joined: 94 },
  { day: "Sun", completed: 64, joined: 68 },
]

export function OrdersTrendChart() {
  return (
    <div className="bg-white border border-border rounded-md p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Weekly Queue Trend</h3>
        <p className="text-xs text-muted-foreground">Joined vs completed over the last 7 days</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={weeklyTrendData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <defs>
            <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="joinedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
            axisLine={false}
            tickLine={false}
          />
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
          <Area
            type="monotone"
            dataKey="joined"
            stroke="#3b82f6"
            strokeWidth={1.5}
            fill="url(#joinedGrad)"
            name="Joined"
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="#10b981"
            strokeWidth={1.5}
            fill="url(#completedGrad)"
            name="Completed"
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "hsl(215 16% 47%)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
