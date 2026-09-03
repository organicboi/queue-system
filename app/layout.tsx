import type { Metadata } from "next"
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic, Noto_Sans_Devanagari } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/shared/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PWARegister } from "@/components/shared/PWARegister"
import { InstallPrompt } from "@/components/display/InstallPrompt"
import { defaultLocale, regionScriptFont } from "@/lib/region"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// The market's secondary script font. Both faces bind the SAME CSS variable
// (--font-script) and only one .variable class is ever put on the tree — the one
// regionScriptFont() picks — so --font-script resolves to whichever script this
// deployment needs, and the other face is never preloaded. The body font stack
// (globals.css --font-sans) resolves per-character, so bilingual content needs
// no per-element font switching.
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-script",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-script",
  subsets: ["devanagari"],
  weight: ["400", "500", "700"],
})

const scriptFontClass =
  regionScriptFont() === "devanagari"
    ? notoSansDevanagari.variable
    : regionScriptFont() === "arabic"
      ? ibmPlexSansArabic.variable
      : ""

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
      lang={defaultLocale()}
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${scriptFontClass}`}
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
