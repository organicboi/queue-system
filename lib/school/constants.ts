// Values shared by server reads and client rendering. Kept out of
// lib/dal/school.ts because that module is `server-only`: importing a constant
// from it drags the service-role Supabase client into the browser bundle.

export const SCHOOL_TOKEN_PAGE_SIZE = 50

// The palette offered by the department editor. Free-form hex is still
// accepted by the server — this is just the set that reads well on a TV board
// at distance and stays legible with white text on top.
export const SCHOOL_DEPARTMENT_COLORS = [
  '#0F766E', '#1D4ED8', '#7C3AED', '#B45309',
  '#0E7490', '#4338CA', '#BE185D', '#B91C1C',
  '#15803D', '#C2410C', '#0891B2', '#475569',
] as const

// Departments store a lucide-react icon name. The kiosk maps these onto
// Material glyphs in mobile/kiosk/lib/src/ui/dept_icon.dart — anything outside
// this list falls back to a generic tag there, so the picker only offers names
// that file knows. Keep the two in step.
export const SCHOOL_DEPARTMENT_ICONS = [
  'Building2', 'Landmark', 'UserPlus', 'Users',
  'Receipt', 'CreditCard', 'Wallet', 'FileText',
  'ClipboardList', 'GraduationCap', 'BookOpen', 'Library',
  'Bus', 'Car', 'ConciergeBell', 'ShoppingBag',
  'ShoppingCart', 'Shirt', 'Accessibility', 'HeartHandshake',
  'Stethoscope', 'Cross', 'Phone', 'Mail',
  'Calendar', 'CalendarDays', 'Home', 'Info',
  'HelpCircle', 'Award', 'BadgeCheck',
] as const

export type SchoolDepartmentIcon = (typeof SCHOOL_DEPARTMENT_ICONS)[number]
