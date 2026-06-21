"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQueueStore } from "@/store/queueStore"
import { toast } from "sonner"
import type { QueueEntry } from "@/lib/types"
import { scaleIn } from "@/lib/animations"

interface AddCustomerModalProps {
  open: boolean
  onClose: () => void
}

type Step = "form" | "success"

export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const addEntry = useQueueStore((s) => s.addEntry)
  const [step, setStep] = useState<Step>("form")
  const [createdEntry, setCreatedEntry] = useState<QueueEntry | null>(null)
  const [billNumber, setBillNumber] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = () => {
    if (!billNumber.trim()) {
      setError("Bill number is required")
      return
    }
    setError("")
    const entry = addEntry(billNumber.trim())
    setCreatedEntry(entry)
    setStep("success")
    toast.success(`Queue #${entry.queueNumber} assigned to Bill ${entry.billNumber}`)
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep("form")
      setCreatedEntry(null)
      setBillNumber("")
      setError("")
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" && (
              <button onClick={() => setStep("form")} className="mr-1">
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            )}
            {step === "form" ? "Add to Queue" : "Queue Assigned"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              variants={scaleIn}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="billNumber">Bill Number</Label>
                <Input
                  id="billNumber"
                  placeholder="e.g. B-1234 or Table 5"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className={error ? "border-destructive" : ""}
                  autoFocus
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <Button onClick={handleSubmit} className="w-full bg-primary hover:bg-primary/90">
                Generate Queue Number
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              variants={scaleIn}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="py-4 text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <span className="text-emerald-600 text-2xl font-bold">✓</span>
              </div>

              <div className="rounded-md bg-gray-50 border border-gray-200 py-6 px-8">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Queue Number</p>
                <p className="text-6xl font-black text-gray-900">#{createdEntry?.queueNumber}</p>
                <p className="text-sm font-mono font-medium text-gray-600 mt-3">
                  Bill {createdEntry?.billNumber}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setStep("form")
                  setCreatedEntry(null)
                  setBillNumber("")
                }}>
                  Add Another
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
