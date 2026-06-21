"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { PageTransition } from "@/components/shared/PageTransition"
import { useSettingsStore } from "@/store/settingsStore"
import { staggerContainer, staggerItem } from "@/lib/animations"
import { toast } from "sonner"

export default function SettingsPage() {
  const settings = useSettingsStore()
  const [localForm, setLocalForm] = useState({
    businessName: settings.businessName,
    businessType: settings.businessType,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    hours: settings.hours,
    queueLabel: settings.queueLabel,
    maxCapacity: settings.maxCapacity,
    averageServiceTime: settings.averageServiceTime,
  })

  const handleSaveBusiness = () => {
    settings.updateBusiness(localForm)
    toast.success("Business settings saved!")
  }

  const handleSaveQueue = () => {
    settings.updateQueue({
      queueLabel: localForm.queueLabel,
      maxCapacity: localForm.maxCapacity,
      averageServiceTime: localForm.averageServiceTime,
    })
    toast.success("Queue configuration saved!")
  }

  return (
    <PageTransition>
      <div className="max-w-3xl space-y-6">
        <Tabs defaultValue="business">
          <TabsList className="mb-6">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="queue">Queue Config</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="bg-white border border-border rounded-md p-6 space-y-5"
            >
              <div>
                <h3 className="font-semibold">Business Information</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  This info appears on public-facing queue pages
                </p>
              </div>
              <Separator />

              <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bname">Business Name</Label>
                  <Input
                    id="bname"
                    value={localForm.businessName}
                    onChange={(e) => setLocalForm((f) => ({ ...f, businessName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="btype">Business Type</Label>
                  <Input
                    id="btype"
                    value={localForm.businessType}
                    onChange={(e) => setLocalForm((f) => ({ ...f, businessType: e.target.value }))}
                    placeholder="e.g. Restaurant, Café, Food Court"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bphone">Phone Number</Label>
                  <Input
                    id="bphone"
                    value={localForm.phone}
                    onChange={(e) => setLocalForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bemail">Email Address</Label>
                  <Input
                    id="bemail"
                    type="email"
                    value={localForm.email}
                    onChange={(e) => setLocalForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="baddress">Address</Label>
                  <Input
                    id="baddress"
                    value={localForm.address}
                    onChange={(e) => setLocalForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bhours">Business Hours</Label>
                  <Input
                    id="bhours"
                    value={localForm.hours}
                    onChange={(e) => setLocalForm((f) => ({ ...f, hours: e.target.value }))}
                    placeholder="e.g. Mon–Fri 9:00 AM – 5:00 PM"
                  />
                </div>
              </motion.div>

              <Button onClick={handleSaveBusiness} className="bg-primary hover:bg-primary/90">
                Save Changes
              </Button>
            </motion.div>
          </TabsContent>

          <TabsContent value="queue">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="bg-white border border-border rounded-md p-6 space-y-5"
            >
              <div>
                <h3 className="font-semibold">Queue Configuration</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Customize how your queue system behaves
                </p>
              </div>
              <Separator />

              <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="qlabel">Queue Label</Label>
                  <Input
                    id="qlabel"
                    value={localForm.queueLabel}
                    onChange={(e) => setLocalForm((f) => ({ ...f, queueLabel: e.target.value }))}
                    placeholder="e.g. Token Number, Order Number"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown to customers as their queue identifier
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxcap">Max Capacity</Label>
                  <Input
                    id="maxcap"
                    type="number"
                    min={1}
                    max={500}
                    value={localForm.maxCapacity}
                    onChange={(e) => setLocalForm((f) => ({ ...f, maxCapacity: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avgservice">Avg Service Time (mins)</Label>
                  <Input
                    id="avgservice"
                    type="number"
                    min={1}
                    max={120}
                    value={localForm.averageServiceTime}
                    onChange={(e) => setLocalForm((f) => ({ ...f, averageServiceTime: Number(e.target.value) }))}
                  />
                </div>
              </motion.div>

              <motion.div variants={staggerItem} className="space-y-3">
                <div className="flex items-center justify-between rounded-sm border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">Allow Self-Join</p>
                    <p className="text-xs text-muted-foreground">Customers can join via the /join page</p>
                  </div>
                  <Switch
                    checked={settings.allowSelfJoin}
                    onCheckedChange={(v) => settings.updateQueue({ allowSelfJoin: v })}
                  />
                </div>
              </motion.div>

              <Button onClick={handleSaveQueue} className="bg-primary hover:bg-primary/90">
                Save Queue Config
              </Button>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="bg-white border border-border rounded-md p-6 space-y-5"
            >
              <div>
                <h3 className="font-semibold">Notification Settings</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure how customers are notified
                </p>
              </div>
              <Separator />

              {[
                {
                  key: "smsEnabled" as const,
                  label: "SMS Notifications",
                  desc: "Send queue updates via SMS",
                  value: settings.smsEnabled,
                },
                {
                  key: "emailEnabled" as const,
                  label: "Email Notifications",
                  desc: "Send queue confirmation and updates via email",
                  value: settings.emailEnabled,
                },
                {
                  key: "soundEnabled" as const,
                  label: "Sound Alerts",
                  desc: "Play sound on queue number change on display screen",
                  value: settings.soundEnabled,
                },
              ].map(({ key, label, desc, value }) => (
                <motion.div
                  key={key}
                  variants={staggerItem}
                  className="flex items-center justify-between rounded-sm border border-border p-4 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={(v) => {
                      settings.updateNotifications({ [key]: v })
                      toast.success(`${label} ${v ? "enabled" : "disabled"}`)
                    }}
                  />
                </motion.div>
              ))}

              <div className="rounded-sm bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700">
                  SMS and email notifications require backend integration.
                  This is a demo — toggles are saved but messages are not sent.
                </p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  )
}
