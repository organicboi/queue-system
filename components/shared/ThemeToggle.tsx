"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settingsStore"

export function ThemeToggle() {
  const { isDarkMode, toggleDarkMode } = useSettingsStore()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDarkMode}
      aria-label="Toggle theme"
    >
      {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
