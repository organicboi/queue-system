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

  updateBusiness: (patch: Partial<Omit<SettingsState, "updateBusiness" | "updateQueue" | "updateNotifications" | "toggleDarkMode">>) => void
  updateQueue: (patch: Partial<Pick<SettingsState, "queueLabel" | "maxCapacity" | "averageServiceTime" | "allowSelfJoin">>) => void
  updateNotifications: (patch: Partial<Pick<SettingsState, "smsEnabled" | "emailEnabled" | "soundEnabled">>) => void
  toggleDarkMode: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      businessName: "TechBiz Queue",
      businessType: "Universal Queue Platform",
      phone: "+1 555-100-2000",
      email: "hello@techbizqueue.com",
      address: "123 Business Ave, San Francisco, CA 94105",
      hours: "Mon–Fri 8:00 AM – 6:00 PM",
      queueLabel: "Queue Number",
      maxCapacity: 50,
      averageServiceTime: 3,
      allowSelfJoin: true,
      isDarkMode: true,
      primaryColor: "violet",
      smsEnabled: false,
      emailEnabled: true,
      soundEnabled: true,

      updateBusiness: (patch) => set((s) => ({ ...s, ...patch })),
      updateQueue: (patch) => set((s) => ({ ...s, ...patch })),
      updateNotifications: (patch) => set((s) => ({ ...s, ...patch })),
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
    }),
    {
      name: "techbizqueue-settings",
    }
  )
)
