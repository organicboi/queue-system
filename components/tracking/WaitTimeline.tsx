"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { QueueStatus } from "@/lib/types"

interface Step {
  label: string
  sublabel?: string
  done: boolean
  active: boolean
}

interface WaitTimelineProps {
  status: QueueStatus
}

export function WaitTimeline({ status }: WaitTimelineProps) {
  const steps: Step[] = [
    {
      label: "Queue Created",
      sublabel: "You've been registered",
      done: true,
      active: false,
    },
    {
      label: "Added to Waiting List",
      sublabel: "Your spot is secured",
      done: true,
      active: false,
    },
    {
      label: "Processing Started",
      sublabel: "You're being served",
      done: status === "completed",
      active: status === "in-progress",
    },
    {
      label: "Service Completed",
      sublabel: "All done!",
      done: status === "completed",
      active: false,
    },
  ]

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex gap-3"
        >
          <div className="flex flex-col items-center">
            <div className="relative">
              {step.done ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 + 0.2, type: "spring", stiffness: 400, damping: 17 }}
                  className="size-5 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                  <span className="text-white text-[10px] font-bold">✓</span>
                </motion.div>
              ) : step.active ? (
                <div className="size-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <div className="size-5 rounded-full border-2 border-gray-200" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-0.5 h-8 mt-1",
                  step.done ? "bg-emerald-300" : "bg-gray-200"
                )}
              />
            )}
          </div>

          <div className="pb-8">
            <p
              className={cn(
                "text-sm font-medium leading-5",
                step.done
                  ? "text-emerald-700"
                  : step.active
                  ? "text-blue-700"
                  : "text-gray-400"
              )}
            >
              {step.label}
            </p>
            <p className="text-xs text-gray-400">{step.sublabel}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
