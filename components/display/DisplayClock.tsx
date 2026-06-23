"use client"

import { useState, useEffect } from "react"

interface DisplayClockProps {
  timeColor?: string
  dateColor?: string
}

export function DisplayClock({ timeColor = "#111827", dateColor = "#9CA3AF" }: DisplayClockProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="text-right" suppressHydrationWarning>
      <p
        className="font-mono font-bold leading-none"
        style={{ fontSize: "clamp(1.1rem, 1.8vw, 2rem)", color: timeColor }}
        suppressHydrationWarning
      >
        {timeStr}
      </p>
      <p
        className="mt-1"
        style={{ fontSize: "clamp(0.6rem, 0.85vw, 0.8rem)", color: dateColor }}
      >
        {dateStr}
      </p>
    </div>
  )
}
