// ── Primitive types ───────────────────────────────────────────
export type UserRole = 'admin' | 'branch_user'
export type CounterType = 'order' | 'billing' | 'kitchen' | 'delivery' | 'call'
export type QueueStatus = 'waiting' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
export type KitchenStatus = 'pending' | 'preparing' | 'ready'
export type QueueSource = 'admin' | 'self-join' | 'kiosk' | 'api'
export type ActivityType = 'joined' | 'called' | 'recalled' | 'completed' | 'cancelled' | 'no-show' | 'reset' | 'paused' | 'resumed' | 'kitchen-bypassed'
export type AdMergeMode = 'replace' | 'prepend' | 'append'
export type ScreenLayout = 'split-standard' | 'rates-wide' | 'rates-full' | 'ads-full' | 'portrait'
export type ScreenTheme = 'standard' | 'dark' | 'vibrant' | 'minimal'
export type AnnouncementLang = 'en' | 'ar' | 'both'
// Which queue product a tenant runs. Set at onboarding; drives every
// post-login redirect and the admin nav.
export type CustomerVertical = 'business' | 'school'

// What a school tenant gets before the distributor grants more. Both are
// per-branch ceilings on ACTIVE rows; deactivating frees a slot.
export const DEFAULT_SCHOOL_DEPARTMENT_LIMIT = 1
export const DEFAULT_SCHOOL_COUNTER_LIMIT = 1
// Guard rail matching customers_max_school_*_check in the migration.
export const MAX_SCHOOL_ENTITLEMENT = 200

// ── DB Row Types (snake_case — exact DB columns) ──────────────
export interface DbPlan {
  id: string
  name: string
  description: string
  max_branches: number
  max_screens_per_branch: number
  max_daily_entries: number
  storage_mb: number
  allow_self_join: boolean
  allow_analytics: boolean
  allow_custom_display: boolean
  allow_ads: boolean
  allow_api_access: boolean
  allow_sms: boolean
  price_monthly: number
  price_yearly: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbCustomer {
  id: string
  name: string
  business_name: string
  slug: string | null
  logo_url: string
  primary_color: string
  secondary_color: string
  phone: string
  email: string
  address: string
  plan_id: string | null
  plan_expires_at: string | null
  is_active: boolean
  vertical: CustomerVertical
  // School capacity the distributor has sold this tenant, counted per branch.
  // See supabase/migrations/20260901_school_entitlements.sql.
  max_school_departments: number
  max_school_counters: number
  branch_ad_mode: AdMergeMode
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export interface DbLicenseKey {
  id: string
  key: string
  plan_id: string
  used_by: string | null
  used_at: string | null
  expires_at: string | null
  notes: string
  // Which product redeeming this key entitles the customer to. Copied onto
  // customers.vertical by onboardAction.
  vertical: CustomerVertical
  customer_id: string | null
  created_at: string
}

export interface DbProfile {
  id: string
  customer_id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbBranch {
  id: string
  customer_id: string
  name: string
  location_note: string
  branch_token: string
  queue_label: string
  allow_self_join: boolean
  max_capacity: number
  avg_service_time: number
  sound_enabled: boolean
  silent_print: boolean
  printer_name: string
  ticker_text: string
  counter_presence_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbUserBranch {
  id: string
  customer_id: string
  user_id: string
  branch_id: string
  created_at: string
}

export interface DbScreen {
  id: string
  customer_id: string
  branch_id: string
  name: string
  screen_token: string
  orientation: 'landscape' | 'portrait'
  layout: ScreenLayout | null
  theme: ScreenTheme | null
  show_ads: boolean | null
  show_ticker: boolean | null
  show_clock: boolean
  show_estimated_wait: boolean
  numbers_to_show: number
  announcement_lang: AnnouncementLang
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface DbCounter {
  id: string
  customer_id: string
  branch_id: string
  name: string
  type: CounterType
  counter_token: string
  is_active: boolean
  accepting_orders: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface DbQueueState {
  id: string
  customer_id: string
  branch_id: string
  current_serving_number: number
  next_queue_number: number
  is_paused: boolean
  updated_at: string
}

export interface DbQueueEntry {
  id: string
  customer_id: string
  branch_id: string
  queue_number: number
  bill_number: string
  customer_name: string
  phone: string
  status: QueueStatus
  kitchen_status: KitchenStatus
  source: QueueSource
  joined_at: string
  started_at: string | null
  completed_at: string | null
  call_count: number
  recall_count: number
  notes: string
  created_at: string
}

export interface DbActivityLog {
  id: string
  customer_id: string
  branch_id: string
  entry_id: string | null
  performed_by: string | null
  source: QueueSource | 'system'
  type: ActivityType
  queue_number: number
  bill_number: string
  message: string
  created_at: string
}

export interface DbAd {
  id: string
  customer_id: string
  branch_id: string | null
  name: string
  file_url: string
  file_type: 'image' | 'video'
  file_size_bytes: number
  duration_seconds: number
  display_order: number
  is_active: boolean
  audio_enabled: boolean
  created_at: string
  updated_at: string
}

export interface DbScreenAd {
  id: string
  customer_id: string
  screen_id: string
  ad_id: string
  display_order: number
  created_at: string
}

export interface DbTickerMessage {
  id: string
  customer_id: string
  branch_id: string | null
  message: string
  display_order: number
  is_active: boolean
  created_at: string
}

// ── DTO Types (camelCase — what crosses to the client) ─────────
export interface PlanDTO {
  id: string
  name: string
  description: string
  maxBranches: number
  maxScreensPerBranch: number
  maxDailyEntries: number
  storageMb: number
  allowSelfJoin: boolean
  allowAnalytics: boolean
  allowCustomDisplay: boolean
  allowAds: boolean
  allowApiAccess: boolean
  allowSms: boolean
  priceMonthly: number
  priceYearly: number
  isActive: boolean
}

export interface CustomerDTO {
  id: string
  name: string
  businessName: string
  slug: string | null
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  phone: string
  email: string
  address: string
  planId: string | null
  planExpiresAt: string | null
  isActive: boolean
  vertical: CustomerVertical
  maxSchoolDepartments: number
  maxSchoolCounters: number
  branchAdMode: AdMergeMode
  onboardedAt: string | null
  createdAt: string
}

export interface LicenseKeyDTO {
  id: string
  key: string
  planId: string
  usedBy: string | null
  usedAt: string | null
  expiresAt: string | null
  notes: string
  vertical: CustomerVertical
  customerId: string | null
  createdAt: string
}

export interface ProfileDTO {
  id: string
  customerId: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  createdAt: string
  // Joined from customers
  customerName?: string
  businessName?: string
  primaryColor?: string
  logoUrl?: string
  planId?: string | null
  planExpiresAt?: string | null
  customerActive?: boolean
  vertical?: CustomerVertical
}

export interface BranchDTO {
  id: string
  customerId: string
  name: string
  locationNote: string
  branchToken: string
  queueLabel: string
  allowSelfJoin: boolean
  maxCapacity: number
  avgServiceTime: number
  soundEnabled: boolean
  silentPrint: boolean
  printerName: string
  tickerText: string
  counterPresenceEnabled: boolean
  isActive: boolean
  createdAt: string
}

export interface ScreenDTO {
  id: string
  customerId: string
  branchId: string
  name: string
  screenToken: string
  orientation: 'landscape' | 'portrait'
  layout: ScreenLayout | null
  theme: ScreenTheme | null
  showAds: boolean | null
  showTicker: boolean | null
  showClock: boolean
  showEstimatedWait: boolean
  numbersToShow: number
  announcementLang: AnnouncementLang
  isActive: boolean
  lastSeenAt: string | null
  createdAt: string
}

export interface CounterDTO {
  id: string
  customerId: string
  branchId: string
  name: string
  type: CounterType
  token: string
  isActive: boolean
  acceptingOrders: boolean
  lastSeenAt: string | null
  createdAt: string
}

// Sanitized shape returned by the get_branch_counter_presence RPC —
// deliberately excludes counter_token/customer_id (see migration).
export interface CounterPresenceEntry {
  id: string
  name: string
  type: CounterType
  isActive: boolean
  lastSeenAt: string | null
}

export interface QueueStateDTO {
  id: string
  customerId: string
  branchId: string
  currentServingNumber: number
  nextQueueNumber: number
  isPaused: boolean
  updatedAt: string
}

export interface QueueEntryDTO {
  id: string
  customerId: string
  branchId: string
  queueNumber: number
  billNumber: string
  customerName: string
  phone: string
  status: QueueStatus
  kitchenStatus: KitchenStatus
  source: QueueSource
  joinedAt: string
  startedAt: string | undefined
  completedAt: string | undefined
  callCount: number
  recallCount: number
  notes: string
  createdAt: string
}

export interface ActivityLogDTO {
  id: string
  customerId: string
  branchId: string
  entryId: string | null
  performedBy: string | null
  source: string
  type: ActivityType
  queueNumber: number
  billNumber: string
  message: string
  createdAt: string
}

export interface AdDTO {
  id: string
  customerId: string
  branchId: string | null
  name: string
  fileUrl: string
  fileType: 'image' | 'video'
  fileSizeBytes: number
  durationSeconds: number
  displayOrder: number
  isActive: boolean
  audioEnabled: boolean
  createdAt: string
}

export interface TickerMessageDTO {
  id: string
  customerId: string
  branchId: string | null
  message: string
  displayOrder: number
  isActive: boolean
  createdAt: string
}

export interface DashboardStats {
  totalToday: number
  waiting: number
  inProgress: number
  completed: number
  cancelled: number
  noShow: number
  avgWaitMinutes: number
}

export interface BranchStats extends DashboardStats {
  branchId: string
  branchName: string
  currentServingNumber: number
  screensCount: number
}

// ── Screen Data Packet (from get_screen_data RPC) ─────────────
export interface ResolvedScreenSettings {
  layout: ScreenLayout
  theme: ScreenTheme
  showAds: boolean
  showTicker: boolean
  showClock: boolean
  showEstimatedWait: boolean
  numbersToShow: number
  orientation: 'landscape' | 'portrait'
  announcementLang: AnnouncementLang
}

export interface ScreenDataPacket {
  status: 'ok' | 'expired' | 'not_configured'
  screenId?: string
  screenName?: string
  branchId?: string
  branchName?: string
  customerId?: string
  businessName?: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  queueLabel?: string
  tickerText?: string
  currentServingNumber?: number
  isPaused?: boolean
  entries?: QueueEntryDTO[]
  ads?: AdDTO[]
  tickers?: TickerMessageDTO[]
  settings?: ResolvedScreenSettings
  allowSelfJoin?: boolean
  planName?: string
}

// ── Branch Data Packet (from get_branch_data RPC) ─────────────
export interface BranchDataPacket {
  status: 'ok' | 'expired' | 'not_configured'
  branchId?: string
  branchName?: string
  branchToken?: string
  customerId?: string
  businessName?: string
  primaryColor?: string
  logoUrl?: string
  queueLabel?: string
  allowSelfJoin?: boolean
  maxCapacity?: number
  avgServiceTime?: number
  soundEnabled?: boolean
  silentPrint?: boolean
  printerName?: string
  tickerText?: string
  currentServingNumber?: number
  isPaused?: boolean
  planName?: string
  allowAds?: boolean
  allowAnalytics?: boolean
}

export interface DistributorStats {
  totalCustomers: number
  activeCustomers: number
  totalBranches: number
  entriesToday: number
}

// ── Mapper Functions ───────────────────────────────────────────
export function toQueueEntryDTO(row: DbQueueEntry): QueueEntryDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    queueNumber: row.queue_number,
    billNumber: row.bill_number,
    customerName: row.customer_name,
    phone: row.phone,
    status: row.status,
    kitchenStatus: row.kitchen_status ?? 'pending',
    source: row.source,
    joinedAt: row.joined_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    callCount: row.call_count,
    recallCount: row.recall_count,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export function toActivityLogDTO(row: DbActivityLog): ActivityLogDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    entryId: row.entry_id,
    performedBy: row.performed_by,
    source: row.source,
    type: row.type,
    queueNumber: row.queue_number,
    billNumber: row.bill_number,
    message: row.message,
    createdAt: row.created_at,
  }
}

export function toBranchDTO(row: DbBranch): BranchDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    locationNote: row.location_note,
    branchToken: row.branch_token,
    queueLabel: row.queue_label,
    allowSelfJoin: row.allow_self_join,
    maxCapacity: row.max_capacity,
    avgServiceTime: row.avg_service_time,
    soundEnabled: row.sound_enabled,
    silentPrint: row.silent_print,
    printerName: row.printer_name,
    tickerText: row.ticker_text,
    counterPresenceEnabled: row.counter_presence_enabled,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function toScreenDTO(row: DbScreen): ScreenDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    name: row.name,
    screenToken: row.screen_token,
    orientation: row.orientation,
    layout: row.layout,
    theme: row.theme,
    showAds: row.show_ads,
    showTicker: row.show_ticker,
    showClock: row.show_clock,
    showEstimatedWait: row.show_estimated_wait,
    numbersToShow: row.numbers_to_show,
    announcementLang: row.announcement_lang ?? 'en',
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }
}

export function toCounterDTO(row: DbCounter): CounterDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    name: row.name,
    type: row.type,
    token: row.counter_token,
    isActive: row.is_active,
    acceptingOrders: row.accepting_orders,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }
}

export function toAdDTO(row: DbAd): AdDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    name: row.name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    durationSeconds: row.duration_seconds,
    displayOrder: row.display_order,
    isActive: row.is_active,
    audioEnabled: row.audio_enabled ?? false,
    createdAt: row.created_at,
  }
}

export function toTickerMessageDTO(row: DbTickerMessage): TickerMessageDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    message: row.message,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function toProfileDTO(row: DbProfile & {
  customer_name?: string
  business_name?: string
  primary_color?: string
  logo_url?: string
  plan_id?: string | null
  plan_expires_at?: string | null
  customer_active?: boolean
  vertical?: CustomerVertical
}): ProfileDTO {
  return {
    id: row.id,
    customerId: row.customer_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    customerName: row.customer_name,
    businessName: row.business_name,
    primaryColor: row.primary_color,
    logoUrl: row.logo_url,
    planId: row.plan_id,
    planExpiresAt: row.plan_expires_at,
    customerActive: row.customer_active,
    vertical: row.vertical ?? 'business',
  }
}

export function toCustomerDTO(row: DbCustomer): CustomerDTO {
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    slug: row.slug,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    phone: row.phone,
    email: row.email,
    address: row.address,
    planId: row.plan_id,
    planExpiresAt: row.plan_expires_at,
    isActive: row.is_active,
    vertical: row.vertical ?? 'business',
    maxSchoolDepartments: row.max_school_departments ?? DEFAULT_SCHOOL_DEPARTMENT_LIMIT,
    maxSchoolCounters: row.max_school_counters ?? DEFAULT_SCHOOL_COUNTER_LIMIT,
    branchAdMode: row.branch_ad_mode,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
  }
}

export function toPlanDTO(row: DbPlan): PlanDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    maxBranches: row.max_branches,
    maxScreensPerBranch: row.max_screens_per_branch,
    maxDailyEntries: row.max_daily_entries,
    storageMb: row.storage_mb,
    allowSelfJoin: row.allow_self_join,
    allowAnalytics: row.allow_analytics,
    allowCustomDisplay: row.allow_custom_display,
    allowAds: row.allow_ads,
    allowApiAccess: row.allow_api_access,
    allowSms: row.allow_sms,
    priceMonthly: row.price_monthly,
    priceYearly: row.price_yearly,
    isActive: row.is_active,
  }
}

// backward-compat re-exports for old code paths
export type { QueueEntryDTO as QueueEntry, ActivityLogDTO as ActivityLog }
