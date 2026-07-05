export interface TVTheme {
  id: string
  name: string
  description: string
  // Page
  pageBg: string
  // Navbar
  navBg: string
  navBorder: string
  navTitle: string
  navSub: string
  navBtn: string
  // Now Serving panel
  servingBg: string
  servingBorder: string
  servingLabel: string
  servingNumber: string
  servingBill: string
  servingEmpty: string
  // Bottom sections
  nextBg: string
  recentBg: string
  sectionBorder: string
  sectionLabel: string
  rowBg: string
  rowBorder: string
  rowNum: string
  rowBill: string
  rowNumDone: string
  rowBillDone: string
  emptyText: string
  // Calling overlay
  callingBg: string
  callingLabel: string
  callingNum: string
  callingSub: string
  callingRecallBg: string
  callingRecallBorder: string
  callingRecallDot: string
  callingRecallText: string
  // Footer ticker
  tickerBg: string
  tickerBorder: string
  tickerChipBg: string
  tickerChipText: string
  tickerText: string
}

/*
 * Design system v5, §5.5 — guest display surface: dark, distance-legible,
 * zero interactivity. Canvas is always dark slate; the "Now Serving" panel
 * is the one solid-accent surface per theme (white or dark text, whichever
 * hits >=4.5:1 on that theme's accent); everything else is neutral. Queue
 * rows never carry the accent — only the serving tile does.
 */
export const STANDARD_THEME: TVTheme = {
  id: "standard",
  name: "Slate",
  description: "Dark, distance-legible — the design-system default",
  pageBg: "#0F172A",
  navBg: "#0F172A",
  navBorder: "#1E293B",
  navTitle: "#F1F5F9",
  navSub: "#64748B",
  navBtn: "#64748B",
  servingBg: "#059669",
  servingBorder: "#059669",
  servingLabel: "#D1FAE5",
  servingNumber: "#FFFFFF",
  servingBill: "#ECFDF5",
  servingEmpty: "#A7F3D0",
  nextBg: "#0F172A",
  recentBg: "#0F172A",
  sectionBorder: "#1E293B",
  sectionLabel: "#64748B",
  rowBg: "#1E293B",
  rowBorder: "#334155",
  rowNum: "#F1F5F9",
  rowBill: "#94A3B8",
  rowNumDone: "#475569",
  rowBillDone: "#334155",
  emptyText: "#334155",
  callingBg: "#059669",
  callingLabel: "#ECFDF5",
  callingNum: "#FFFFFF",
  callingSub: "#D1FAE5",
  callingRecallBg: "rgba(255,255,255,0.15)",
  callingRecallBorder: "rgba(255,255,255,0.35)",
  callingRecallDot: "#FFFFFF",
  callingRecallText: "#FFFFFF",
  tickerBg: "#0F172A",
  tickerBorder: "#1E293B",
  tickerChipBg: "#059669",
  tickerChipText: "#FFFFFF",
  tickerText: "#94A3B8",
}

export const GOLD_THEME: TVTheme = {
  id: "gold",
  name: "Dark Gold",
  description: "Full dark with a gold accent — premium luxury feel",
  pageBg: "#0F172A",
  navBg: "#0F172A",
  navBorder: "#1E293B",
  navTitle: "#F8FAFC",
  navSub: "#475569",
  navBtn: "#475569",
  servingBg: "#F59E0B",
  servingBorder: "#F59E0B",
  servingLabel: "#78350F",
  servingNumber: "#1C1305",
  servingBill: "#78350F",
  servingEmpty: "#FDE68A",
  nextBg: "#0F172A",
  recentBg: "#0B1120",
  sectionBorder: "#1E293B",
  sectionLabel: "#475569",
  rowBg: "#1E293B",
  rowBorder: "#334155",
  rowNum: "#F8FAFC",
  rowBill: "#94A3B8",
  rowNumDone: "#475569",
  rowBillDone: "#334155",
  emptyText: "#334155",
  callingBg: "#F59E0B",
  callingLabel: "#78350F",
  callingNum: "#1C1305",
  callingSub: "#78350F",
  callingRecallBg: "rgba(28,19,5,0.12)",
  callingRecallBorder: "rgba(28,19,5,0.25)",
  callingRecallDot: "#1C1305",
  callingRecallText: "#1C1305",
  tickerBg: "#020617",
  tickerBorder: "#0F172A",
  tickerChipBg: "#F59E0B",
  tickerChipText: "#1C1305",
  tickerText: "#64748B",
}

export const BLUE_THEME: TVTheme = {
  id: "blue",
  name: "Airport Blue",
  description: "Dark slate with a deep blue accent — max readability",
  pageBg: "#0F172A",
  navBg: "#0F172A",
  navBorder: "#1E293B",
  navTitle: "#F1F5F9",
  navSub: "#64748B",
  navBtn: "#64748B",
  servingBg: "#1D4ED8",
  servingBorder: "#1D4ED8",
  servingLabel: "#DBEAFE",
  servingNumber: "#FFFFFF",
  servingBill: "#EFF6FF",
  servingEmpty: "#BFDBFE",
  nextBg: "#0F172A",
  recentBg: "#0F172A",
  sectionBorder: "#1E293B",
  sectionLabel: "#64748B",
  rowBg: "#1E293B",
  rowBorder: "#334155",
  rowNum: "#F1F5F9",
  rowBill: "#94A3B8",
  rowNumDone: "#475569",
  rowBillDone: "#334155",
  emptyText: "#334155",
  callingBg: "#1D4ED8",
  callingLabel: "#DBEAFE",
  callingNum: "#FFFFFF",
  callingSub: "#EFF6FF",
  callingRecallBg: "rgba(255,255,255,0.15)",
  callingRecallBorder: "rgba(255,255,255,0.35)",
  callingRecallDot: "#FFFFFF",
  callingRecallText: "#FFFFFF",
  tickerBg: "#0F172A",
  tickerBorder: "#1E293B",
  tickerChipBg: "#1D4ED8",
  tickerChipText: "#FFFFFF",
  tickerText: "#94A3B8",
}

export const ESPRESSO_THEME: TVTheme = {
  id: "espresso",
  name: "Warm Espresso",
  description: "Rich espresso brown with an orange accent — cozy cafe feel",
  pageBg: "#1A0D07",
  navBg: "#1A0D07",
  navBorder: "#2D1810",
  navTitle: "#FEF3C7",
  navSub: "#92400E",
  navBtn: "#92400E",
  servingBg: "#F97316",
  servingBorder: "#F97316",
  servingLabel: "#431407",
  servingNumber: "#1A0D07",
  servingBill: "#431407",
  servingEmpty: "#FED7AA",
  nextBg: "#1A0D07",
  recentBg: "#130A05",
  sectionBorder: "#2D1810",
  sectionLabel: "#92400E",
  rowBg: "#2D1810",
  rowBorder: "#3D2214",
  rowNum: "#FEF3C7",
  rowBill: "#D97706",
  rowNumDone: "#4B2613",
  rowBillDone: "#3D2214",
  emptyText: "#3D2214",
  callingBg: "#F97316",
  callingLabel: "#431407",
  callingNum: "#1A0D07",
  callingSub: "#431407",
  callingRecallBg: "rgba(26,13,7,0.15)",
  callingRecallBorder: "rgba(26,13,7,0.3)",
  callingRecallDot: "#1A0D07",
  callingRecallText: "#1A0D07",
  tickerBg: "#080400",
  tickerBorder: "#1A0D07",
  tickerChipBg: "#F97316",
  tickerChipText: "#1A0D07",
  tickerText: "#92400E",
}

export const ALL_THEMES = [STANDARD_THEME, GOLD_THEME, BLUE_THEME, ESPRESSO_THEME]
export const THEME_ROUTES: Record<string, string> = {
  standard: "/display/standard",
  gold: "/display1",
  blue: "/display2",
  espresso: "/display3",
}

export const THEMES: Record<string, TVTheme> = {
  standard: STANDARD_THEME,
  dark: ESPRESSO_THEME,
  vibrant: GOLD_THEME,
  minimal: BLUE_THEME,
}
