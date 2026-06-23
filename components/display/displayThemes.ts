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

export const STANDARD_THEME: TVTheme = {
  id: "standard",
  name: "Standard",
  description: "Clean light UI — high readability in bright rooms",
  pageBg: "#F5F6F8",
  navBg: "#FFFFFF",
  navBorder: "#E5E7EB",
  navTitle: "#111827",
  navSub: "#9CA3AF",
  navBtn: "#9CA3AF",
  servingBg: "#FFFFFF",
  servingBorder: "#E5E7EB",
  servingLabel: "#9CA3AF",
  servingNumber: "#111827",
  servingBill: "#6B7280",
  servingEmpty: "#D1D5DB",
  nextBg: "#FFFFFF",
  recentBg: "#F5F6F8",
  sectionBorder: "#E5E7EB",
  sectionLabel: "#9CA3AF",
  rowBg: "#FFFFFF",
  rowBorder: "#F3F4F6",
  rowNum: "#111827",
  rowBill: "#6B7280",
  rowNumDone: "#D1D5DB",
  rowBillDone: "#9CA3AF",
  emptyText: "#D1D5DB",
  callingBg: "#0F172A",
  callingLabel: "#F59E0B",
  callingNum: "#FFFFFF",
  callingSub: "#94A3B8",
  callingRecallBg: "rgba(245,158,11,0.10)",
  callingRecallBorder: "rgba(245,158,11,0.20)",
  callingRecallDot: "#F59E0B",
  callingRecallText: "#F59E0B",
  tickerBg: "#0F172A",
  tickerBorder: "#1E293B",
  tickerChipBg: "#F59E0B",
  tickerChipText: "#0F172A",
  tickerText: "#CBD5E1",
}

export const GOLD_THEME: TVTheme = {
  id: "gold",
  name: "Dark Gold",
  description: "Full dark with gold accents — premium luxury feel",
  pageBg: "#0F172A",
  navBg: "#0F172A",
  navBorder: "#1E293B",
  navTitle: "#F8FAFC",
  navSub: "#475569",
  navBtn: "#475569",
  servingBg: "#0F172A",
  servingBorder: "#1E293B",
  servingLabel: "#475569",
  servingNumber: "#F59E0B",
  servingBill: "#94A3B8",
  servingEmpty: "#334155",
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
  callingBg: "#000000",
  callingLabel: "#F59E0B",
  callingNum: "#F59E0B",
  callingSub: "#64748B",
  callingRecallBg: "rgba(245,158,11,0.10)",
  callingRecallBorder: "rgba(245,158,11,0.20)",
  callingRecallDot: "#F59E0B",
  callingRecallText: "#F59E0B",
  tickerBg: "#020617",
  tickerBorder: "#0F172A",
  tickerChipBg: "#F59E0B",
  tickerChipText: "#020617",
  tickerText: "#64748B",
}

export const BLUE_THEME: TVTheme = {
  id: "blue",
  name: "Airport Blue",
  description: "White left panel, deep blue number — max readability",
  pageBg: "#FFFFFF",
  navBg: "#FFFFFF",
  navBorder: "#E2E8F0",
  navTitle: "#0F172A",
  navSub: "#94A3B8",
  navBtn: "#94A3B8",
  servingBg: "#FFFFFF",
  servingBorder: "#E2E8F0",
  servingLabel: "#94A3B8",
  servingNumber: "#1D4ED8",
  servingBill: "#3B82F6",
  servingEmpty: "#CBD5E1",
  nextBg: "#FFFFFF",
  recentBg: "#F8FAFC",
  sectionBorder: "#E2E8F0",
  sectionLabel: "#94A3B8",
  rowBg: "#FFFFFF",
  rowBorder: "#E2E8F0",
  rowNum: "#1D4ED8",
  rowBill: "#64748B",
  rowNumDone: "#CBD5E1",
  rowBillDone: "#94A3B8",
  emptyText: "#CBD5E1",
  callingBg: "#0F172A",
  callingLabel: "#3B82F6",
  callingNum: "#FFFFFF",
  callingSub: "#64748B",
  callingRecallBg: "rgba(59,130,246,0.10)",
  callingRecallBorder: "rgba(59,130,246,0.20)",
  callingRecallDot: "#3B82F6",
  callingRecallText: "#3B82F6",
  tickerBg: "#0F172A",
  tickerBorder: "#1E293B",
  tickerChipBg: "#1D4ED8",
  tickerChipText: "#FFFFFF",
  tickerText: "#94A3B8",
}

export const ESPRESSO_THEME: TVTheme = {
  id: "espresso",
  name: "Warm Espresso",
  description: "Rich espresso browns with orange accents — cozy café feel",
  pageBg: "#1A0D07",
  navBg: "#1A0D07",
  navBorder: "#2D1810",
  navTitle: "#FEF3C7",
  navSub: "#92400E",
  navBtn: "#92400E",
  servingBg: "#1A0D07",
  servingBorder: "#2D1810",
  servingLabel: "#92400E",
  servingNumber: "#F97316",
  servingBill: "#D97706",
  servingEmpty: "#2D1810",
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
  callingBg: "#080400",
  callingLabel: "#F97316",
  callingNum: "#F97316",
  callingSub: "#92400E",
  callingRecallBg: "rgba(249,115,22,0.10)",
  callingRecallBorder: "rgba(249,115,22,0.20)",
  callingRecallDot: "#F97316",
  callingRecallText: "#F97316",
  tickerBg: "#080400",
  tickerBorder: "#1A0D07",
  tickerChipBg: "#F97316",
  tickerChipText: "#080400",
  tickerText: "#92400E",
}

export const ALL_THEMES = [STANDARD_THEME, GOLD_THEME, BLUE_THEME, ESPRESSO_THEME]
export const THEME_ROUTES: Record<string, string> = {
  standard: "/display/standard",
  gold: "/display1",
  blue: "/display2",
  espresso: "/display3",
}
