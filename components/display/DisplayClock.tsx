"use client"

import { useState, useEffect } from "react"

export function DisplayClock() {
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
      <p className="text-2xl font-mono font-bold text-gray-900" suppressHydrationWarning>{timeStr}</p>
      <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
    </div>
  )
}
