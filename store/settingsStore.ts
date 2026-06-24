"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsState {
  businessName: string
  businessType: string
  phone: string
  email: string
  address: string
  hours: string
  queueLabel: string
  maxCapacity: number
  averageServiceTime: number
  allowSelfJoin: boolean
  isDarkMode: boolean
  primaryColor: string
  smsEnabled: boolean
  emailEnabled: boolean
  soundEnabled: boolean
  silentPrint: boolean
  printerName: string

  updateBusiness: (patch: Partial<Omit<SettingsState, "updateBusiness" | "updateQueue" | "updateNotifications" | "toggleDarkMode" | "updatePrinting">>) => void
  updateQueue: (patch: Partial<Pick<SettingsState, "queueLabel" | "maxCapacity" | "averageServiceTime" | "allowSelfJoin">>) => void
  updateNotifications: (patch: Partial<Pick<SettingsState, "smsEnabled" | "emailEnabled" | "soundEnabled">>) => void
  updatePrinting: (patch: Partial<Pick<SettingsState, "silentPrint" | "printerName">>) => void
  toggleDarkMode: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      businessName: "My Restaurant",
      businessType: "Restaurant",
      phone: "+1 555-100-2000",
      email: "hello@myrestaurant.com",
      address: "123 Main St, San Francisco, CA 94105",
      hours: "Daily 11:00 AM – 10:00 PM",
      queueLabel: "Queue Number",
      maxCapacity: 50,
      averageServiceTime: 3,
      allowSelfJoin: true,
      isDarkMode: true,
      primaryColor: "violet",
      smsEnabled: false,
      emailEnabled: true,
      soundEnabled: true,
      silentPrint: true,
      printerName: "",

      updateBusiness: (patch) => set((s) => ({ ...s, ...patch })),
      updateQueue: (patch) => set((s) => ({ ...s, ...patch })),
      updateNotifications: (patch) => set((s) => ({ ...s, ...patch })),
      updatePrinting: (patch) => set((s) => ({ ...s, ...patch })),
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
    }),
    {
      name: "techbizqueue-settings",
    }
  )
)
