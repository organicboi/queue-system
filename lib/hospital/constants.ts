// Values shared by server reads and client rendering. Kept out of
// lib/dal/hospital.ts because that module is `server-only`: importing a
// constant from it drags the service-role Supabase client into the browser
// bundle (same rule as lib/school/constants.ts).

export const HOSPITAL_TOKEN_PAGE_SIZE = 50

// The palette offered by the department editor. Free-form hex is still
// accepted by the server — this is just the set that reads well on a TV board
// at distance and stays legible with white text on top.
export const HOSPITAL_DEPARTMENT_COLORS = [
  '#0F766E', '#1D4ED8', '#7C3AED', '#B45309',
  '#0E7490', '#4338CA', '#BE185D', '#B91C1C',
  '#15803D', '#C2410C', '#0891B2', '#475569',
] as const

// Departments store a lucide-react icon name — clinical-leaning set, plus the
// generic ones. The web kiosk renders these directly.
export const HOSPITAL_DEPARTMENT_ICONS = [
  'Stethoscope', 'HeartPulse', 'Bone', 'Baby',
  'Eye', 'Brain', 'Ear', 'Smile',
  'Syringe', 'Microscope', 'ScanLine', 'TestTube',
  'Pill', 'Receipt', 'CreditCard', 'ClipboardList',
  'Thermometer', 'Activity', 'UserPlus', 'Users',
  'Building2', 'Cross', 'Accessibility', 'Info',
] as const

export type HospitalDepartmentIcon = (typeof HOSPITAL_DEPARTMENT_ICONS)[number]

// ── Public ticket tracking base URL ────────────────────────────
// The origin the QR on a printed ticket points at — the shared /t/[code]
// route, same as school. Set NEXT_PUBLIC_PUBLIC_BASE_URL to swap in a short
// custom domain later without touching any print code.
export function publicTrackingBaseUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return (requestOrigin ?? '').replace(/\/+$/, '')
}

export function publicTrackingUrl(code: string, requestOrigin?: string): string {
  return `${publicTrackingBaseUrl(requestOrigin)}/t/${code}`
}
