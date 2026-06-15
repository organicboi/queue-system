"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
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
import { QRCodeSVG } from "qrcode.react"
import { useQueueStore } from "@/store/queueStore"
import { useSettingsStore } from "@/store/settingsStore"
import { generateTrackingUrl } from "@/lib/queueUtils"
import { staggerContainer, staggerItem, successBounce, scaleIn } from "@/lib/animations"
import { toast } from "sonner"
import type { QueueEntry, ServiceType, QueueType } from "@/lib/types"

type Step = "form" | "success"

const serviceTypes: ServiceType[] = [
  "Food Order",
  "Consultation",
  "Repair Service",
  "Document Verification",
]

export default function JoinPage() {
  const { addEntry, getPositionInQueue } = useQueueStore()
  const { businessName, hours, address } = useSettingsStore()
  const [step, setStep] = useState<Step>("form")
  const [entry, setEntry] = useState<QueueEntry | null>(null)
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
    if (!form.service) e.service = "Please select a service type"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const created = addEntry({
      name: form.name,
      phone: form.phone,
      email: form.email,
      service: form.service as ServiceType,
      type: form.type,
    })
    setEntry(created)
    setStep("success")
    toast.success(`Welcome, ${form.name}! You're #${created.queueNumber}`)
  }

  const position = entry ? getPositionInQueue(entry.queueNumber) : 0
  const trackingUrl = entry ? generateTrackingUrl(entry.trackingToken) : ""

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900">{businessName}</h1>
          <p className="text-sm text-gray-500 mt-1">Join the queue below</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white border border-gray-200 rounded-md p-6 space-y-4"
            >
              <motion.div variants={staggerItem} className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </motion.div>

              <motion.div variants={staggerItem} className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  placeholder="+1 555-000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </motion.div>

              <motion.div variants={staggerItem} className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </motion.div>

              <motion.div variants={staggerItem} className="space-y-1.5">
                <Label>Service Type *</Label>
                <Select
                  value={form.service}
                  onValueChange={(v) => setForm((f) => ({ ...f, service: v as ServiceType }))}
                >
                  <SelectTrigger className={errors.service ? "border-destructive" : ""}>
                    <SelectValue placeholder="What do you need help with?" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.service && <p className="text-xs text-destructive">{errors.service}</p>}
              </motion.div>

              <motion.div variants={staggerItem}>
                <Button
                  onClick={handleSubmit}
                  className="w-full h-11 text-base bg-primary hover:bg-primary/90"
                >
                  Join Queue
                </Button>
              </motion.div>

              <motion.div variants={staggerItem} className="text-center text-xs text-muted-foreground">
                By joining, you agree to receive queue updates.
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              variants={scaleIn}
              initial="hidden"
              animate="show"
              className="bg-white border border-gray-200 rounded-md p-6 space-y-5 text-center"
            >
              <motion.div variants={successBounce} initial="hidden" animate="show">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <span className="text-emerald-600 text-2xl font-bold">✓</span>
                </div>
              </motion.div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">You're in!</h2>
                <p className="text-sm text-gray-500 mt-1">Welcome, {entry?.name}</p>
              </div>

              <div className="rounded-sm bg-gray-50 border border-gray-200 p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your Queue Number</p>
                <p className="text-6xl font-black text-gray-900">#{entry?.queueNumber}</p>
                {position > 0 && (
                  <p className="text-sm text-gray-500 mt-2">{position} people ahead of you</p>
                )}
                {position === 0 && (
                  <p className="text-sm text-emerald-600 font-medium mt-2">You're next!</p>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-sm bg-white border border-gray-200 p-3">
                  <QRCodeSVG value={trackingUrl} size={140} fgColor="#0f172a" bgColor="#ffffff" />
                </div>
                <p className="text-xs text-gray-400">Scan to track your queue status</p>
              </div>

              <div className="flex flex-col gap-2">
                <Button asChild className="w-full bg-primary hover:bg-primary/90">
                  <Link href={`/track/${entry?.trackingToken}`}>
                    Track My Queue
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep("form")
                    setEntry(null)
                    setForm({ name: "", phone: "", email: "", service: "", type: "normal" })
                  }}
                >
                  Join for Another Person
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Business info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center text-xs text-gray-400 space-y-0.5"
        >
          <p>{address}</p>
          <p>{hours}</p>
        </motion.div>
      </div>
    </div>
  )
}
