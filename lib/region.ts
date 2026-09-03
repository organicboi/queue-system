// Per-deployment market. One build serves one country; the country is chosen by
// the NEXT_PUBLIC_APP_COUNTRY env var (ISO 3166-1 alpha-2), which Next inlines at
// build time. There is deliberately NO "region" column in the database — the two
// Supabase projects (Gulf, India) stay byte-identical, and a feature that must
// not exist in the other market simply has its env var unset there.
//
// Deliberately free of `server-only` and of any Supabase / `next` import: the
// kiosk, the public tracker, the admin forms and the server-side guards all read
// this, and a server-only module would drag the service-role client into the
// browser bundle (same reason lib/verticals.ts and lib/school/constants.ts are
// kept clean). NEVER add a Supabase or next/* import here.

export type CountryCode = 'AE' | 'IN' // extend as markets are added

// Superset of every locale any market offers. A market exposes only the subset
// in its `languages` capability.
export type Locale = 'en' | 'ar' | 'mr' | 'hi'

/**
 * A translatable content value, keyed by locale. `en` is mandatory — it is the
 * universal fallback for every surface and every market.
 */
export type LocaleMap = { en: string } & Partial<Record<Locale, string>>

export interface RegionCapabilities {
  /**
   * Locales this market may offer on customer-facing device surfaces (kiosk,
   * board, public tracker, printed ticket, announcements). Index 0 is the
   * market's base locale: the kiosk's initial language, the board/print primary,
   * and the fallback when a stored value is unusable.
   */
  languages: Locale[]
  // Future country-scoped flags land here, e.g. `smsNotifications: boolean`.
  // `Record<CountryCode, RegionMeta>` below forces every market to set every
  // capability, so adding one is a compile error until all markets are updated.
}

export interface RegionMeta {
  country: CountryCode
  /** Internal / debug label — never shown to a customer. */
  label: string
  /** Seeds school_settings.timezone for new rows and orders the timezone picker. */
  defaultTimezone: string
  capabilities: RegionCapabilities
}

const REGIONS: Record<CountryCode, RegionMeta> = {
  AE: {
    country: 'AE',
    label: 'Gulf',
    defaultTimezone: 'Asia/Dubai',
    capabilities: { languages: ['en', 'ar'] },
  },
  IN: {
    country: 'IN',
    label: 'India',
    defaultTimezone: 'Asia/Kolkata',
    capabilities: { languages: ['en', 'mr', 'hi'] },
  },
}

// Unset or unrecognised env var → behave exactly as the original Gulf build did.
const FALLBACK_COUNTRY: CountryCode = 'AE'

export function countryCode(): CountryCode {
  const raw = process.env.NEXT_PUBLIC_APP_COUNTRY?.trim().toUpperCase()
  return raw && raw in REGIONS ? (raw as CountryCode) : FALLBACK_COUNTRY
}

export function region(): RegionMeta {
  return REGIONS[countryCode()]
}

export function capabilities(): RegionCapabilities {
  return region().capabilities
}

/** The locales this market may offer, base locale first. */
export function regionLocales(): Locale[] {
  return capabilities().languages
}

/** The market's base locale — kiosk default, board/print primary, fallback. */
export function defaultLocale(): Locale {
  return regionLocales()[0]
}

export function isRegionLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (regionLocales() as string[]).includes(value)
}

/**
 * Sanitise a stored `languages` array against the current market: drop anything
 * this market does not offer (e.g. a stray `'ar'` copied into the India DB), and
 * never return empty — a device surface with no language has nothing to render.
 */
export function coerceLocales(stored: readonly string[] | null | undefined): Locale[] {
  const kept = (stored ?? []).filter(isRegionLocale) as Locale[]
  return kept.length ? kept : [defaultLocale()]
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  mr: 'मराठी',
  hi: 'हिन्दी',
}

const RTL_LOCALES: readonly Locale[] = ['ar']

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}

export function regionHasRtl(): boolean {
  return regionLocales().some((l) => RTL_LOCALES.includes(l))
}

/**
 * The non-Latin script this market's secondary font must cover, or null when the
 * market is English-only. The layout loads exactly this one font so the other
 * script's @font-face never enters the bundle.
 */
export function regionScriptFont(): 'arabic' | 'devanagari' | null {
  if (regionLocales().includes('ar')) return 'arabic'
  if (regionLocales().some((l) => l === 'mr' || l === 'hi')) return 'devanagari'
  return null
}

/**
 * Read one locale out of a LocaleMap (or the raw locale-keyed JSON an RPC
 * emits), falling back to English then to an empty string. Framework-free so it
 * is safe in client components and on RPC-shaped data alike.
 */
export function pickLocale(
  map: LocaleMap | Record<string, string> | null | undefined,
  locale: Locale,
): string {
  if (!map) return ''
  const m = map as Record<string, string>
  return m[locale] ?? m.en ?? ''
}
