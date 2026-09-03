# Hospital Queue Management System — India

> **Plan status: Phase 1 shipped (2026-09-04).** Written 2026-09-03, modelled on
> `docs/school-queue-plan.md`. Phase 1 (the OPD operating loop + reception +
> public tracking + reports) is built and committed on branch
> `queue-system-india` — see **"Status as built"** below. **Phase 2 and Phase 3
> are deferred — planned for much later, not being worked on now.**

## Status as built (Phase 1 — 2026-09-04)

Shipped on branch `queue-system-india` across four commits:

| Commit | Scope |
|---|---|
| `a155110` | Migration (`supabase/migrations/20260908_hospital_queue_system.sql`), `lib/db/hospital-types.ts`, `lib/db/types.ts` widenings, `lib/dal/hospital.ts` + `hospital-context.ts` + `hospital-limits.ts`, `proxy.ts` gating, vertical routing (`lib/verticals.ts`, admin/branch/owner isolation guards, onboarding seed in `lib/actions/auth.ts` + `distributor.ts`), `lib/actions/hospital-admin.ts`, and the `(manage)` shell — dashboard, departments, doctors (schedules + leaves), rooms, screens, ads, settings, users |
| `e8f202e` | The operating loop: `lib/actions/hospital-tokens.ts` + `hospital-read.ts` + broadcast helpers, `lib/hooks/useHospitalBoard.ts` + `useHospitalRoom.ts`, `components/hospital/HospitalKiosk.tsx` + thermal ticket, `HospitalBoard.tsx` + announcer, `HospitalRoomConsole.tsx` (doctor + service-point modes), and the three `(device)` pages (kiosk / display / room) |
| `37e9987` | Reception (`/hospital/patients` — search, DPDP-consent registration, issue-token-on-behalf, cancel / no-show rejoin, access logging), `/t/[code]` hospital fallback in the shared tracker + API route, token history + CSV (`/hospital/tokens`), reports (`/hospital/reports` — volume, by-department, journey funnel, busiest hours, doctor productivity) |
| `495b787` | Triage → consultation routing: `transfer_hospital_token` gains `p_assign_doctor_id`, `HospitalRoomView.consultTargets`, and the triage-room "send to consultation" panel — a triage token keeps its number into a doctor's queue |

**What works end-to-end:** onboard a `vertical='hospital'` customer → seed
departments → add doctors + weekly schedules → add rooms + assign session
doctors → register a TV screen → kiosk issues a per-department token → doctor
console calls it (board flips, flashes, announces in the branch language) →
SEND TO Lab → lab calls it → REPORT READY returns it to the same doctor at
`stage='review'` → DONE → Pharmacy → Billing. One token, one number, the whole
journey; `/hospital/tokens` and the printed-ticket QR follow it.

**Deviations / caveats accepted for Phase 1:**

- `claim_hospital_token` verifies a doctor has a schedule row for today's
  weekday but does **not** enforce `max_tokens` or the am/pm session.
- Room access is shared-URL only (no per-room user binding) — as flagged in
  "Open items".
- `plans.max_daily_entries` remains unenforced (inherited from base + school).
- `hospital_appointments` exists in the migration (columns are free) but no
  surface reads or writes it yet — that is Phase 2.
- `check_in_appointment` is **not** in the shipped migration — it lands with
  Phase 2 appointments.
- Realtime is broadcast + short poll, no `alter publication`, as planned.

## Context

This repo (VibeQueue) is a multi-tenant queue platform. The restaurant/retail
domain lives in the base tables; the school domain shipped as a parallel
`/school` vertical with its own tables, RPCs, and device surfaces
(`supabase/migrations/20260825_school_queue_system.sql`, `app/(school)/school/`).
The deployment is already split by country via `NEXT_PUBLIC_APP_COUNTRY` — an
India Supabase project exists, and `screens.announcement_lang` already accepts
`'mr'`/`'hi'` (`20260903_region_language_support.sql`).

We need to sell a **hospital OPD queue system** in India: registration/triage,
per-doctor consultation queues, lab/radiology/pharmacy service points, TV
boards with vernacular voice announcements, WhatsApp/SMS patient notification,
and a reception + doctor + manager console.

Three things make this a new vertical rather than a school re-skin:

- **Queues are per doctor, not per counter.** A patient waits for "Dr. Sharma,
  Room 4", and doctors have schedules, sessions (morning/evening), leaves, and
  wildly different consult speeds. The school model has no person-level
  scheduling entity at all.
- **The journey is multi-stage.** One patient flows Registration → (Triage) →
  Consult → Lab → *back to the same doctor for review* → Pharmacy → Billing.
  Neither existing domain can re-enter a queue, and the review re-entry jump is
  the flow Indian hospitals care most about getting right.
- **India rails.** WhatsApp is the notification channel; SMS needs DLT-registered
  templates (TRAI); payments are UPI-first; UI/print/voice need English + Hindi
  + one regional language; DPDP Act 2023 makes patient PII a consent and
  retention problem; power cuts and flaky 4G are routine, so devices must
  degrade gracefully.

**Decisions taken:** build the hospital system in its own `/hospital` route
namespace with its own tables, exactly as school did. A customer account is
one vertical (`customers.vertical`, widened to include `'hospital'`), set at
onboarding. One token follows the patient across every stage of a visit — the
patient never juggles multiple numbers. The token series is **per department**
(school cursor pattern); the *queue ordering* is per doctor. Patient names
never appear on boards or announcements — token codes only (privacy + DPDP).

**Outcome:** a `/hospital/*` product — kiosk, TV board, doctor console,
service-point consoles, reception, manager dashboard — on the same deployment,
login, tenancy, ads, and screens infrastructure as today.

---

## Architecture

### Namespace

```
app/(hospital)/hospital/
  (manage)/                        ← session-protected, own sidebar layout
    dashboard/  tokens/  reports/  appointments/  patients/
    departments/  doctors/  rooms/  screens/  settings/  users/
  (device)/                        ← token-authed, bare full-screen layout
    kiosk/[branchToken]/           ← self-service check-in + walk-in dispenser
    display/[screenToken]/         ← TV waiting-area board
    room/[roomToken]/              ← doctor / service-point calling console
  (public)/
    book/[branchToken]/            ← patient appointment-booking PWA (Phase 2)
```

Route groups resolving to distinct paths under one segment is the pattern
already used by `(school)` — same approach, no new framework risk.

`proxy.ts` gains `/hospital` to its protected list, **excluding**
`/hospital/kiosk`, `/hospital/display`, `/hospital/room`, `/hospital/book` —
those authenticate by URL token or are patient-public, exactly like the school
device paths (`proxy.ts:44-57`).

`customers.vertical` CHECK widens to `('business','school','hospital')`.
`app/(admin)/layout.tsx` and `lib/actions/auth.ts` (`loginAction`) route
hospital customers into `/hospital/*`, mirroring the school redirect.

### Reused as-is — do not duplicate

| Concern | Reuse |
|---|---|
| Tenancy & auth | `lib/dal/session.ts` (`requireProfile` / `requireAdmin` / `requireBranchManager`), `lib/dal/users.ts` |
| DB access rule | `createSupabaseServiceClient()` everywhere + app-level guards; new tables get the service-role-only RLS policy loop from `20260825_school_queue_system.sql:262` |
| Vertical routing | `customers.vertical` + the school precedent in `app/(admin)/layout.tsx`, `lib/actions/auth.ts` |
| TV registration | the existing `screens` table + `screen_token` + `screens.kind` (add `'hospital'`) — ads cascade, screen quota, `last_seen_at` presence come free |
| Media & announcements | `ads`, `screen_ads`, `ticker_messages` + school wrappers (`SchoolAdsManager.tsx` pattern → thin hospital copy if wording differs) |
| Display parts | `components/display/AdPanel.tsx`, `AdTicker.tsx`, `DisplayClock.tsx`, `displayThemes.ts`, `lib/hooks/useFitScale.ts` |
| Printing | `lib/school/printTicket.ts` (already has the `useCORS: true` fix the school plan flagged) + QZ Tray / RawBT paths in `lib/silentPrint.ts` |
| Console UI kit | `components/counter/console.tsx` — `ConsoleFrame`, `TaskSplit`, `KeypadKey`, `ElapsedPill`, `useTapGuard`, `ConfirmCancel`, `useNow` |
| Admin CRUD pattern | `components/school/SchoolCountersManager.tsx` — `useActionState` + dialog + token copy/regenerate/soft-delete |
| Device surfaces' viewport lock | zoom-locked `viewport` export pattern from the school device pages |
| Public live tracking | the `/t/` route + non-enumerable public code pattern from `20260902_school_public_tracking.sql` — the printed-ticket QR story is identical |
| Entitlements | the `20260901_school_entitlements.sql` pattern (plain columns on `customers`, distributor-set) — hospital add-ons (WhatsApp, public tracking) gate the same way |
| Board resilience | `lib/hooks/useSchoolBoard.ts` — broadcast + short poll as state of record + resubscribe (the deviation that *replaced* postgres_changes for school; hospital follows it from day one — see Realtime below) |
| Announcements | `lib/school/announce.ts` — three-tier `window.AndroidTTS` → Web Speech → WebAudio chime, templates in settings, per-screen `announcement_lang` |
| Charts | recharts via `components/school/SchoolReports.tsx` patterns |
| Design rules | `design-system-v5.md` — same checklist applies to every new route |

---

## India-specific requirements (design drivers, not features)

- **Languages.** Per-branch language list, max 3 (`en` + `hi` + one regional).
  Applies to kiosk UI, printed ticket, board text, and **voice announcements**.
  The `announcement_lang` CHECK already accepts `'en','ar','mr','hi','both'`;
  widen once more if a third slot is needed, or store per-screen language on
  `hospital_settings` — decide at build time, don't fork the column.
- **Priority is social, not just medical.** Senior citizen (60+), emergency,
  pregnant, differently-abled are *expected* priority categories — a visible
  kiosk/reception toggle (`hospital_tokens.priority_category`), not a hidden
  admin flag. Strict priority-first starves the normal lane; reuse the school's
  effective-wait key (priority grace window) rather than hard sort.
- **Notifications.** WhatsApp first (Gupshup / Interakt / MSG91 — pick one BSP,
  hide behind `lib/hospital/notify.ts`), SMS fallback. **Every SMS template must
  be DLT-registered** (TRAI) before it can send — collect template IDs in
  `hospital_settings`, not in code. WhatsApp templates need Meta approval —
  same treatment. Triggers: token issued, 3-away, called, transferred,
  report ready, feedback link after checkout.
- **Payments.** UPI (Razorpay/Cashfree) for consultation-fee collection at
  kiosk or booking time — Phase 2. Token fee and consultation fee only;
  hospital *billing* stays out of scope (this is queue software, not an HMS).
- **DPDP Act 2023.** Health data is sensitive personal data. Consequences
  baked into the schema below: explicit consent captured at registration
  (`consent_at`), PII isolated in `hospital_patients` (token rows carry only
  `patient_id`), per-branch `patient_data_retention_days` with a purge job,
  insert-only audit on patient-record access, and **no patient names on any
  board, ticket stub beyond first name, or voice announcement**.
- **Power & network.** Server-action issuance means a LAN/WAN outage stops
  ticketing — accepted for v1 (same as school), but the kiosk must cache its
  department/doctor list and the board must show last-known state instead of a
  white page. UPS at the reception desk is an install requirement, not a
  feature.
- **ABHA / ABDM.** Phase 3 only: ABHA number field + verify/link at
  registration; ABDM FHIR push later. The column exists from day one
  (`abha_number text null`) so the migration is free, but nothing reads it in
  v1. "ABDM-ready" is a sales line for government-adjacent hospitals.
- **Follow-up visits.** Free revisit within N days (hospital-configurable,
  standard Indian OPD practice) → `hospital_visits.type = 'followup'`,
  reception-flagged, typically prioritized in the ordering key.

---

## Schema

**All hospital DDL goes in `supabase/migrations/2026XXXX_hospital_queue.sql`
only — do NOT add it to `supabase/schema.sql`.** That file opens with a
`drop table … cascade` block; see the school plan for the full hazard. Keep a
separate `supabase/hospital-schema.sql` if a fresh-install file is wanted.

Tables (all carry `customer_id`, service-role-only RLS, `on delete cascade`
from `branches`/`customers` unless noted):

- **`hospital_settings`** — one row per branch: `hospital_name`, `logo_url`,
  `languages text[]` (max 3, first is default), `ticket_footer`,
  `kiosk_idle_seconds`, `announce_enabled`, `announce_templates jsonb`
  (per-language, like `20260904_school_content_locale_jsonb.sql`),
  `print_enabled`, `timezone` (default **`Asia/Kolkata`**),
  `day_start_time` (default `00:00`), `appt_walkin_ratio int default 2`,
  `followup_free_days int default 7`, `priority_enabled`,
  `priority_grace_minutes int default 10`, `patient_data_retention_days int`,
  `notify_whatsapp_enabled`, `notify_sms_enabled`,
  `dlt_template_ids jsonb` (event → DLT template id).
- **`hospital_departments`** — `branch_id, name, name_i18n jsonb, prefix`
  (1–3 chars), `type` (`'opd'|'lab'|'radiology'|'pharmacy'|'billing'|'triage'`),
  `color, icon, display_order, is_active`.
  **`unique (branch_id, prefix) where is_active`** — same collision hazard as
  school. OPD specialities (General Medicine, Ortho, Paeds…) and service
  points (Lab, X-Ray, Pharmacy, Billing) are one table distinguished by `type`;
  the kiosk shows `opd`, the transfer UI targets the rest.
- **`hospital_doctors`** — `branch_id, department_id (opd only), name,
  specialization, fee_paise int, avg_consult_minutes int default 10, is_active`.
  Names live here, not on tokens — the board shows "Dr. Sharma · Room 4"
  because that's *hospital staff* identity, not patient PII.
- **`hospital_doctor_schedules`** — `doctor_id, weekday int (0–6),
  session text ('am'|'pm'), start_time, end_time, slot_minutes int,
  max_tokens int`. A doctor with no schedule row for today doesn't appear on
  the kiosk. `unique (doctor_id, weekday, session)`.
- **`hospital_doctor_leaves`** — `doctor_id, leave_date, reason`.
  `unique (doctor_id, leave_date)`. Marking a leave must cascade: block new
  bookings, and (Phase 2) notify booked patients. The kiosk checks
  schedule-minus-leave, never schedule alone.
- **`hospital_rooms`** — `branch_id, department_id, label` ("Room 4",
  "Lab Bay 2", "Pharmacy 1"), `room_token` (unique uuid text — the console's
  URL credential, same trust model as `school_counters.counter_token`),
  `current_doctor_id uuid null` (which doctor sits here *today* — set by
  reception at session start, not a schedule fact), `is_open, is_active,
  last_seen_at`.
- **`hospital_patients`** — the **only PII table**: `customer_id, uhid text`
  (per-customer patient number, `unique (customer_id, uhid)`), `name, phone,
  dob, gender, abha_number text null, consent_at timestamptz not null`.
  No branch_id — patients are customer-wide; visits are branch-scoped.
- **`hospital_visits`** — `patient_id, branch_id, visit_date, type
  ('new'|'followup'), status ('active'|'completed')`. One active visit per
  patient per branch: `unique (patient_id, branch_id) where status='active'`.
  The thread that ties a multi-stage journey together and survives the token.
- **`hospital_tokens`** — the central row. `visit_id, department_id, doctor_id
  (null at service points), room_id (null until called), service_date, number,
  token_code, stage ('registration'|'triage'|'consult'|'lab'|'radiology'|
  'pharmacy'|'billing'|'review'), status ('waiting'|'called'|'serving'|'held'|
  'served'|'no-show'|'cancelled'), priority_category text null
  ('senior'|'emergency'|'pregnant'|'differently-abled'), source
  ('kiosk'|'reception'|'appointment'|'whatsapp'|'api'), appointment_id uuid null,
  notes, joined_at, called_at, served_at, call_count, recall_count`.
  `UNIQUE(branch_id, service_date, token_code)`;
  **`unique index on hospital_tokens(room_id) where status='called'`** — one
  live token per room, DB-enforced (school pattern, no mutable pointer);
  `unique (appointment_id) where appointment_id is not null` — check-in is
  idempotent. Indexes: `(branch_id, service_date, status)`,
  `(doctor_id, service_date, status, joined_at)`,
  `(department_id, service_date, status)`, `(visit_id)`.
  **One token per visit per stage-chain**: on transfer the *same row* mutates
  `department_id`/`stage`/`status='waiting'` and appends to the events table —
  the patient keeps one number all day. `token_code` never changes, so
  `(branch_id, service_date, token_code)` uniqueness survives transfers.
- **`hospital_department_days`** — `(department_id, service_date)` unique +
  `next_number`. The per-department daily cursor; a new date row starts at the
  department's `number_start`, so the **daily reset is free** — no cron.
  (Copied verbatim from the school pattern; series is per department even
  though ordering is per doctor — two doctors in Cardiology share the `C`
  series, which matches how Indian OPD tickets actually read.)
- **`hospital_doctor_days`** — `(doctor_id, service_date)` unique +
  `served_count int`, `walkins_since_last_appt int`. The appointment/walk-in
  interleave cursor for `call_next_hospital_token` (see RPCs).
- **`hospital_appointments`** *(Phase 2)* — `doctor_id, patient_id, slot_time
  timestamptz, booked_via ('pwa'|'reception'|'whatsapp'), fee_paise,
  payment_status ('unpaid'|'paid'|'refunded'), status ('booked'|'checked_in'|
  'cancelled'|'noshow'), token_id uuid null`. Availability derived from
  schedule − leaves − already-booked slots − `max_tokens`.
- **`hospital_vitals`** — `token_id` (one row per token, `unique (token_id)`),
  `bp_systolic, bp_diastolic, spo2, temp_c, weight_kg, notes, recorded_by`.
  Filled at the triage stage; doctor console reads it with the call.
- **`hospital_token_events`** — insert-only audit. `token_id, from_status,
  to_status, from_stage, to_stage, room_id, actor ('kiosk'|'reception'|'room'|
  'system'), performed_by uuid null, created_at`. This is what makes
  "where did the patient spend 3 hours" answerable, and it is the source for
  every report. Never updated, never hard-deleted.
- **`hospital_patient_access_logs`** — `patient_id, accessed_by, reason,
  created_at`. DPDP auditability: who looked at which patient record, when.
  Written from the DAL read paths for patient detail views, not from boards.

**`screens.kind` CHECK widens to `('queue','school','hospital')`** — a token is
valid at exactly one board route, same one-line mechanism as school.

**Realtime: broadcast + poll, NOT postgres_changes.** School's build proved
the anon-key subscription path would need an anon SELECT policy, which would
expose URL credentials (`school-queue-plan.md` §"Deviations", item 1).
Hospital has strictly more sensitive rows (patient linkage), so the rule holds
harder: live updates go over Realtime **broadcast** topics
(`hospital-display-${branchId}`, `hospital-room-${roomId}`) with a short poll
as state of record — which doubles as the drop-recovery path a ceiling-mounted
TV in a power-cut-prone building needs. The migration deliberately does **not**
`alter publication`. Never hard-delete tokens; close them via status.

**Timezone.** `service_date` is computed **only in SQL**, never in JS and never
from the client, via `hospital_service_date(branch_id)` — a copy of
`school_service_date` (`20260825_school_queue_system.sql:304`) reading
`hospital_settings.timezone` (default `Asia/Kolkata`) and `day_start_time`.
Every board/dashboard/report query derives its day boundary through the same
helper. An RPC and a dashboard disagreeing by one day is the most likely
support ticket this product will generate.

### RPCs (SECURITY DEFINER, convention per `claim_school_token`)

- **`claim_hospital_token(branch_id, department_id, doctor_id, visit_id, …)`** —
  walk-in issuance. Cursor bump is a single
  `insert … on conflict (department_id, service_date) do update set
  next_number = next_number + 1 returning next_number - 1` — one-row upsert
  holds the row lock to commit, so concurrent kiosks serialize with no
  advisory lock, and a failed token insert rolls the increment back (gapless
  series). Never select-then-update (TOCTOU). Validates: department active,
  doctor belongs to department **and** has a schedule row today **and** is not
  on leave **and** has not hit `max_tokens`. Rejects service-point departments
  (`type <> 'opd'`) — you cannot walk in to Pharmacy.
- **`check_in_appointment(appointment_id)`** — converts a booked appointment
  into a token. Idempotent via the `unique (appointment_id)` partial index:
  a double-tap or a retried request returns the existing token, never a
  second one. Sets `source='appointment'`.
- **`call_next_hospital_token(room_id)`** — the heart of the system. Resolves
  the room's `current_doctor_id` (or, for service-point rooms, its department),
  picks the next `waiting` token with
  `FOR UPDATE … SKIP LOCKED` (two rooms on one department must never receive
  the same token), closes out whatever the room was serving (→ `served`),
  stamps `called`/`called_at`/`room_id`. Ordering key:

  ```
  -- OPD rooms: appointment/walk-in interleave with priority grace
  effective = t.joined_at
            - grace (if priority_category is not null)
            - review_boost (if stage = 'review')
  -- but: if doctor_days.walkins_since_last_appt >= appt_walkin_ratio
  --       and an appointment-sourced token is waiting, appointments win
  ```

  The ratio counter on `hospital_doctor_days` makes the interleave
  deterministic and auditable instead of a vibe in application code. Strict
  priority-first starves the normal lane (school learned this — cap it with
  the grace window). Review tokens (patient back from lab) get a boost but do
  not hard-jump — a returning patient goes next-ish, not instantly.
- **`transfer_hospital_token(token_id, to_department_id, to_stage)`** —
  the multi-stage mechanic. Sets the current stage `served`, mutates
  `department_id`/`stage`, resets `status='waiting'` with a **new**
  `joined_at`, writes one `hospital_token_events` row covering the whole hop.
  The review re-entry is just this RPC with `to_stage='review'` and the
  original `doctor_id` restored — no special-case table.
- **`get_hospital_board(screen_token)`** — one round trip per TV: one row per
  **open room** (always visible, current `called` token or "—" — a "last N
  called" list makes a room vanish three calls later), a recently-served strip,
  per-department waiting counts, doctor-on-leave / session-delayed indicators,
  branding, and the ads/ticker cascade copied from `get_school_board`. Stamps
  `screens.last_seen_at`. **Returns token codes and room/doctor labels only —
  never joins `hospital_patients`.**

Types: follow the shipped school layout — `lib/db/hospital-types.ts` with
`Db*` / `*DTO` / `to*DTO` per table plus a `HospitalBoardPacket`, not appended
to `lib/db/types.ts` (school deviation 2, adopted as convention).

---

## Surfaces

Device pages export the zoom-locked `viewport` — fast repeated taps on a touch
terminal must never trigger pinch/double-tap zoom.

**Kiosk** `/hospital/kiosk/[branchToken]` — authenticates on
`branches.branch_token`. Flow: language picker (first-run, remembered) →
department grid (colour + icon + large targets) → doctor list for that
department *today* (schedule − leave, photo optional, fee shown) → priority
category (self-declared toggle) → confirm → 80 mm thermal ticket. **The token
row commits server-side before printing is attempted**, and the big token code
stays on screen for `kiosk_idle_seconds` regardless — if RawBT/QZ throws, the
patient still has their number. Ticket markup from
`lib/school/printTicket.ts` (the `useCORS: true` fix is already in): token code
large, department, doctor, **QR pointing at `/t/[publicCode]`**, footer in the
branch's languages. Appointment holders skip the flow: scan booking QR →
`check_in_appointment` → ticket.

**TV board** `/hospital/display/[screenToken]` — new component on the §5.5 dark
token set, following `SchoolBoard.tsx` (not a fork of `TVDisplay.tsx`). Header
(logo, hospital name, clock + date), per-room TOKEN | ROOM | DOCTOR table, a
one-shot flash + TTS overlay on call, reused ads panel (health-awareness
content is the natural ad inventory here) and ticker. Announcements reuse the
three-tier announcer via a `lib/hospital/announce.ts` copy — templates per
language from `hospital_settings.announce_templates`; the utterance spells the
prefix letter then the digits and names the room ("Token C one zero four,
Room four"). Web Speech API covers `hi-IN` and major Indian languages on-device
— good enough for v1, no TTS service. **45–60 s safety poll + resubscribe
handler from day one** (the school deviation, promoted to a rule): a TV that
drops its WebSocket in a power blink must recover with nobody there to reload
it. Boards show **token codes and room/doctor names only** — never patient
names.

**Room console** `/hospital/room/[roomToken]` — one console, two modes, driven
by the room's department type:

- *Doctor mode* (OPD rooms): current-token hero with vitals card (if triage
  ran) and visit type, **CALL NEXT**, **RECALL**, **NO SHOW** (two-tap
  `ConfirmCancel`), **HOLD**, **DONE**, **SEND TO** → Lab / Radiology /
  Pharmacy (fires `transfer_hospital_token`), waiting lane for this doctor
  with §5.3 FIFO emphasis and appointment-vs-walk-in badges, end-session.
- *Service-point mode* (lab/radiology/pharmacy/billing rooms): the school's
  counter console shape — CALL NEXT / RECALL / NO SHOW / DONE against the
  department queue, plus **REPORT READY / DONE → REVIEW** on lab/radiology
  which transfers the patient back to their doctor at `stage='review'`.

Every mutation re-verifies the room token server-side, mirroring
`verifyCounterToken` (`lib/actions/counters.ts`). The hardware keypad story is
the school's: USB-HID keypads enumerate as keyboards — global `keydown` with
input-target guard and inter-key buffering; LAN keypads deferred until a model
that speaks HTTP is confirmed (see school plan's keypad caveat — a Vercel route
handler cannot receive raw TCP/Modbus).

**Reception** — `/hospital/(manage)/patients` + a register/check-in drawer, not
a device surface: patient search (UHID/phone), register (consent checkbox —
DPDP — captures `consent_at`), new/follow-up visit, walk-in token issue on
behalf (`source='reception'`), appointment calendar, payment collection
(Phase 2), priority tagging, transfer, no-show rejoin, ticket reprint.
Reception is the escape hatch for everything the kiosk can't express.

**Patient status PWA** `/t/[publicCode]` — reuse the school public-tracking
pattern verbatim: non-enumerable 8-char code on the token row, one RPC
answering "where do I stand" (position, now-serving, **estimated wait** =
position × doctor's rolling `avg_consult_minutes`), adaptive poll, no auth, no
Supabase round trip in `proxy.ts` (`/t/` already exempted). This is the QR on
the printed ticket — no app install, which is the correct India answer.

**Booking PWA** `/hospital/book/[branchToken]` *(Phase 2)* — department →
doctor → day → slot grid (from schedule − leaves − booked), patient details,
UPI payment if the hospital charges at booking, confirmation with QR + WhatsApp
message. Shares the patient/appointment tables with reception; no separate
patient account system in v1 (phone + OTP is enough).

**Manager** — `/hospital/dashboard` (Waiting / Serving / Served / Avg-wait
tiles, live per-department and per-doctor board, rooms open/closed),
`/hospital/reports` (recharts: tokens per department, **stage funnel** —
registration→consult→lab→pharmacy dwell times from `hospital_token_events`,
doctor productivity, peak-hour heatmap, no-show rate; daily/weekly/monthly;
CSV export; this *is* the NABH wait-time evidence pack),
`/hospital/tokens` (history + CSV), `/hospital/appointments`,
`/hospital/departments`, `/hospital/doctors` (incl. schedules & leaves UI —
leave creation must warn about affected bookings), `/hospital/rooms`,
`/hospital/screens`, `/hospital/settings`, `/hospital/users`.

Avg wait = `called_at − joined_at` **per stage** (a transferred token's wait
clock restarts — that's honest, the patient *was* being served in between).
Do not replicate the restaurant `completed_at − started_at` mislabel the
school plan flagged.

---

## Notifications (Phase 2, but schema-ready now)

`lib/hospital/notify.ts` — one module, one BSP behind it. Triggered from the
RPC-adjacent server actions (issue, call, 3-away sweep, transfer, report
ready, feedback), never from the client. Rules:

- Every outbound text is a **template id looked up from settings**, never a
  string in code — SMS templates are DLT-registered, WhatsApp templates are
  Meta-approved, and both are per-hospital artifacts.
- Send is fire-and-forget with a delivery log row (`hospital_notification_logs`
  — token_id, channel, template, status) so a BSP outage doesn't block calling
  and support can answer "did you send it".
- Phone numbers come from `hospital_patients` at send time; the notification
  layer is the *only* place outside reception that reads PII in bulk.
- Gated per customer via the entitlements pattern (distributor-set column) —
  WhatsApp notification is a billable add-on, same as school public tracking.

---

## Build order

**Phase 1 — the OPD operating loop (walk-in only) — ✅ DONE (2026-09-04).**
All twelve items below shipped; the migration landed as
`20260908_hospital_queue_system.sql` (without `check_in_appointment`, which
moved to Phase 2). See "Status as built" above for the commit map.

1. `supabase/migrations/2026XXXX_hospital_queue.sql` — 12 tables (all except
   `hospital_appointments` … no — include it now, columns are free; only the
   *surfaces* are Phase 2), indexes, partial unique indexes, service-role RLS
   loop, `customers.vertical` + `screens.kind` CHECK widenings, and the five
   RPCs (`hospital_service_date`, `claim_hospital_token`,
   `check_in_appointment`, `call_next_hospital_token`,
   `transfer_hospital_token`, `get_hospital_board`). **No `alter publication`.**
2. `lib/db/hospital-types.ts` — `Db*` / `*DTO` / `to*DTO` + `HospitalBoardPacket`.
3. `lib/dal/hospital.ts` + `lib/dal/hospital-context.ts` — `cache()` +
   `createSupabaseServiceClient()`, mirroring `lib/dal/school.ts`.
4. `lib/actions/hospital-admin.ts`, `hospital-tokens.ts`, `hospital-read.ts` +
   broadcast helpers (copy the school broadcast, retyped).
5. `proxy.ts` — `/hospital` gated except kiosk/display/room/book;
   `customers.vertical` routing in `app/(admin)/layout.tsx` and
   `lib/actions/auth.ts`; hospital gets its own `HospitalSidebar` (school
   deviation 4, adopted).
6. `(manage)/{layout,departments,doctors,rooms,screens,settings}` + a "seed the
   standard OPD departments" action. **Settings and screens are Phase 1** —
   kiosk ticket and board need hospital name/logo/languages/timezone, and
   without the screens page there's no token to test the board with.
7. `lib/hooks/useHospitalBoard.ts` (broadcast + safety poll + resubscribe) and
   `useHospitalQueue.ts`.
8. `components/hospital/HospitalKiosk.tsx` + ticket +
   `(device)/kiosk/[branchToken]`.
9. `components/hospital/HospitalBoard.tsx` + `lib/hospital/announce.ts` +
   `(device)/display/[screenToken]`.
10. `components/hospital/HospitalRoomConsole.tsx` (both modes) +
    `(device)/room/[roomToken]`.
11. Reception: `/hospital/patients` + register/check-in drawer + vitals entry
    (triage).
12. `/t/[publicCode]` hospital tracking — port the school public-tracking
    migration pattern + page.

**Phase 2 — reach — ⏸ DEFERRED (planned for much later, not being built now).**

13. Appointments end-to-end: booking PWA, reception calendar, `check_in_appointment`
    wiring at the kiosk, appointment/walk-in interleave verification.
14. Notifications: BSP integration, DLT/Meta template management in settings,
    delivery logs.
15. UPI payments at booking/kiosk; fee reports.
16. Estimated wait on ticket and tracking PWA (rolling per-doctor average).

**Phase 3 — moat — ⏸ DEFERRED (planned for much later, not being built now).**

17. ABHA number verify/link; ABDM FHIR push exploration.
18. EMR-lite (doctor notes + e-Rx PDF on the visit) — only if pulled by
    customers; it is a different product's gravity well.
19. Hardware bundle (kiosk + thermal printer + TV) install playbook; UPS and
    offline-degradation checklist.
20. Chain-level (customer-wide, multi-branch) roll-up dashboard.

---

## Open items to flag, not silently drop

- **Room access control.** A room console is authenticated by a shared URL
  token — anyone with the link can call tokens at Dr. Sharma's room. Roles are
  only `admin | branch_user`. Either accept this (as both existing verticals
  do) or add per-room user binding later.
- **`plans.max_daily_entries` is unenforced** in the current code; a busy OPD
  will blow past a Starter tier on day one (inherited from school verbatim).
- **Offline issuance is zero** — a WAN outage stops ticketing. The kiosk caches
  its pick-lists (Phase 1) but cannot issue tokens offline without a local
  store-and-forward layer, which is a deliberate non-goal for v1.
- **One doctor, two rooms / two doctors, one room across sessions.** The model
  resolves this through `hospital_rooms.current_doctor_id` set per session by
  reception — but the *UX* for the swap (and what happens to a waiting queue
  when the doctor changes mid-session) needs a designed answer at build time,
  not an emergent one.
- **Interleave ratio is a blunt instrument.** `appt_walkin_ratio` serves
  appointments fairly but doesn't honor slot *times* (a 10:40 booking checked
  in at 10:00 may jump a 10:20). Acceptable v1; if hospitals complain, order
  appointment tokens by `slot_time` instead of `joined_at` in the RPC — one
  ORDER BY change, not a redesign.
- **Multi-branch patient identity.** `hospital_patients` is customer-wide, so a
  patient registered at Branch A is known at Branch B — intended, but flag the
  privacy implication in the DPDP consent copy.
- **Retention enforcement.** `patient_data_retention_days` needs a scheduled
  purge (pg_cron or an external cron hitting an RPC) — picking the mechanism
  is a deployment question the plan deliberately leaves open.

---

## Verification

- **Migration**: apply, then re-run — must be idempotent like the existing
  ones. Confirm it does **not** touch `supabase_realtime` publication.
- **Numbering**: two kiosks issuing concurrently in two departments — series
  independent, gapless, collision-free. Roll `service_date` to confirm the
  daily reset fires at local midnight (or `day_start_time`), never UTC.
- **Concurrency**: two room consoles on the same department pressing CALL NEXT
  simultaneously must never receive the same token (`SKIP LOCKED`); the partial
  unique index must reject any second `called` row per room. Double check-in on
  one appointment returns the same token, not a second.
- **Interleave**: with ratio 2 and a mixed lane, serve order is A,A,W,A,A,W…;
  with priority grace 10, a priority token jumps only past sub-10-minute
  waiters; a review token returns ahead of fresh walk-ins but behind
  long-waiting ones.
- **Journey end-to-end** (`npm run dev`, browser automation across five tabs):
  kiosk issues `C101` → triage records vitals → doctor room calls `C101`,
  board flips + flashes + announces in the configured language → SEND TO LAB →
  lab room calls the same `C101` → REPORT READY returns it to the doctor at
  `stage='review'` → doctor sees the vitals card and review badge → DONE →
  pharmacy → billing → visit completes; `hospital_token_events` shows every hop.
- **Board resilience**: kill the network on the display tab, restore it, and
  confirm the board recovers without a manual reload (poll + resubscribe).
- **Privacy**: board, ticket, tracking PWA, and announcement contain **no
  patient name**; `get_hospital_board` response contains no patient columns;
  patient detail views write `hospital_patient_access_logs` rows.
- **Print**: ticket renders 80 mm with the token code large, the QR resolving
  to `/t/[publicCode]`, and a Supabase-hosted logo actually appearing
  (the `useCORS` fix — verify, don't assume).
- **Isolation**: exercise `/school/*`, `/counter/[token]`, `/display/[token]`
  and `/dashboard` on `vertical='school'` and `'business'` customers and
  confirm nothing changed.
- **Design system**: run the §9 checklist on each new route, both orientations,
  each configured language.
- `npm run lint` and `npm run build` clean.

---

## Compliance checklist (DPDP Act 2023)

- [x] Consent captured at registration (`consent_at`), enforced by `registerHospitalPatientAction` (DPDP checkbox, refuses without it)
- [x] PII isolated to `hospital_patients`; boards/tickets/announcements carry codes only (`get_hospital_board` never joins patients; kiosk/board/room UIs show token + room + doctor only)
- [x] Patient-record access audited — `hospital_patient_access_logs` written from `getHospitalPatientDetail` / reception read paths
- [~] Retention policy configurable (`patient_data_retention_days` on `hospital_settings`, editable in settings form) — **purge job not built** (Phase 3, mechanism still open)
- [x] Token/visit history exportable — `/hospital/tokens` CSV export. Erasure/purge is Phase 3.
- [x] Notification templates contain no clinical content — templates are queue facts only (notifications themselves are Phase 2)
