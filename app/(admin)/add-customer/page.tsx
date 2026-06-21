"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useQueueStore } from "@/store/queueStore"
import { toast } from "sonner"
import type { QueueEntry } from "@/lib/types"

type Step = "entry" | "success"

export default function AddCustomerPage() {
  const router = useRouter()
  const addEntry = useQueueStore((s) => s.addEntry)
  const [step, setStep] = useState<Step>("entry")
  const [billNumber, setBillNumber] = useState("")
  const [createdEntry, setCreatedEntry] = useState<QueueEntry | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const handleSubmit = () => {
    const trimmed = billNumber.trim()
    if (!trimmed) return
    const entry = addEntry(trimmed)
    setCreatedEntry(entry)
    setStep("success")
    toast.success(`Queue #${entry.queueNumber} assigned to Bill ${entry.billNumber}`)
  }

  const handleAddAnother = () => {
    setBillNumber("")
    setCreatedEntry(null)
    setStep("entry")
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {step === "entry" ? (
            <motion.div
              key="entry"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold text-gray-900">Quick Entry</h2>
                <p className="text-sm text-muted-foreground">Enter bill number to assign a queue spot</p>
              </div>

              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                placeholder="Bill number…"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-md border border-input bg-background px-4 py-4 text-center text-3xl font-bold tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <Button
                onClick={handleSubmit}
                disabled={!billNumber.trim()}
                className="w-full h-12 text-base bg-primary hover:bg-primary/90"
              >
                Generate Queue Number
              </Button>

              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="space-y-6 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <span className="text-emerald-600 text-2xl font-bold">✓</span>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 py-8 px-10 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Queue Number</p>
                <p className="text-7xl font-black text-gray-900 tabular-nums">
                  #{createdEntry?.queueNumber}
                </p>
                <p className="text-sm font-mono text-muted-foreground mt-1">
                  Bill {createdEntry?.billNumber}
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleAddAnother}>
                  Add Another
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => router.push("/dashboard")}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
