"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { hourlyVolumeData } from "@/lib/mockData"

export function HourlyVolumeChart() {
  return (
    <div className="bg-white border border-border rounded-md p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Customer Volume by Hour</h3>
        <p className="text-xs text-muted-foreground">Today's queue arrivals throughout the day</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={hourlyVolumeData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="hour"
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
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar
            dataKey="customers"
            fill="#1e3a5f"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
