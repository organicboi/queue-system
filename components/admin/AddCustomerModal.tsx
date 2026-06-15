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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQueueStore } from "@/store/queueStore"
import { QRDisplay } from "./QRDisplay"
import { toast } from "sonner"
import type { QueueEntry, ServiceType, QueueType } from "@/lib/types"
import { scaleIn } from "@/lib/animations"

interface AddCustomerModalProps {
  open: boolean
  onClose: () => void
}

type Step = "form" | "success"

const serviceTypes: ServiceType[] = [
  "Food Order",
  "Consultation",
  "Repair Service",
  "Document Verification",
]

export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const addEntry = useQueueStore((s) => s.addEntry)
  const [step, setStep] = useState<Step>("form")
  const [createdEntry, setCreatedEntry] = useState<QueueEntry | null>(null)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    service: "" as ServiceType | "",
    type: "normal" as QueueType,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Name is required"
    if (!form.phone.trim()) e.phone = "Phone is required"
    if (!form.service) e.service = "Service type is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const entry = addEntry({
      name: form.name,
      phone: form.phone,
      email: form.email,
      service: form.service as ServiceType,
      type: form.type,
    })
    setCreatedEntry(entry)
    setStep("success")
    toast.success(`Queue #${entry.queueNumber} created for ${entry.name}`)
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep("form")
      setCreatedEntry(null)
      setForm({ name: "", phone: "", email: "", service: "", type: "normal" })
      setErrors({})
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" && (
              <button onClick={() => setStep("form")} className="mr-1">
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            )}
            {step === "form" ? "Add Customer" : "Queue Generated"}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Customer Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="+1 555-000-0000"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={errors.phone ? "border-destructive" : ""}
                  />
                  {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@email.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Service Type *</Label>
                  <Select
                    value={form.service}
                    onValueChange={(v) => setForm((f) => ({ ...f, service: v as ServiceType }))}
                  >
                    <SelectTrigger className={errors.service ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.service && <p className="text-[11px] text-destructive">{errors.service}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Queue Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as QueueType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            >
              {createdEntry && (
                <QRDisplay
                  token={createdEntry.trackingToken}
                  queueNumber={createdEntry.queueNumber}
                  customerName={createdEntry.name}
                />
              )}
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={handleClose}
              >
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
