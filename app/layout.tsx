import type { Metadata } from "next"
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/shared/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PWARegister } from "@/components/shared/PWARegister"
import { InstallPrompt } from "@/components/display/InstallPrompt"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Design system v5, §3 — pairs with Geist for Arabic script; the font
// stack resolves per-character, so a single body font-family works for
// bilingual EN/AR content without per-element language switching.
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
})

export const metadata: Metadata = {
  title: "TechBiz Queue — Queue Management Platform",
  description:
    "Premium queue management SaaS for restaurants, clinics, banks, and any business managing customer waiting lines.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSansArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PWARegister />
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
        </ThemeProvider>
        <InstallPrompt />
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "glass border-border",
            },
          }}
        />
      </body>
    </html>
  )
}
