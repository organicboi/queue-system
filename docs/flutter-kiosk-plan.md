# Flutter Kiosk App — Build Plan

**Audience:** this doc is a handoff to a *different* Claude Code session that will build the app. Read it fully before writing any code. It assumes no prior context on this conversation — everything you need is either in this file or in the referenced repo paths.

**Repo:** `/home/akshay/Projects/queue-system` (Next.js + Supabase multi-tenant queue system; the school vertical is what this app targets). This plan lives at `docs/flutter-kiosk-plan.md` inside that repo.

---

## 0. What already exists — read before touching anything

There is a **working native Android kiosk wrapper already in production**, written 2 days before this plan, at `android-kiosk/` (a plain Kotlin/Gradle project, NOT Flutter — do not confuse it with what you're building). It's a WebView that loads the school kiosk web page and hands off `rawbt:` intents to the RawBT print app. Read these before starting, they encode real production decisions you must not silently drop:

- `android-kiosk/app/src/main/java/com/vibequeue/kiosk/MainActivity.kt` — kiosk-mode behavior worth preserving: fullscreen/hide system UI, ignore the back button, retry on page-load failure, **reclaim foreground after handing off to another app** (so the next visitor isn't stuck looking at the wrong app).
- `android-kiosk/app/src/main/java/com/vibequeue/kiosk/BootReceiver.kt` — auto-launches on device boot. Your Flutter app needs the equivalent (`RECEIVE_BOOT_COMPLETED` + a boot receiver, or a Flutter plugin that does this).
- `android-kiosk/app/src/main/AndroidManifest.xml` — `singleTask` launch mode, boot receiver, `<queries>` block for package visibility.
- `lib/school/printTicket.ts` — **this is the ground truth for how a ticket must look and why.** It deliberately rasterizes the ticket to a 1-bit bitmap rather than sending ESC/POS text commands, because: (a) tickets carry per-tenant logos, (b) the school product is bilingual EN/AR and Arabic text shaping breaks in ESC/POS text mode, (c) exact dot-width math matters (58mm roll, 384-dot/48mm-printable head at 8 dots/mm). **Your native printing must follow the same bitmap-rasterization strategy**, not ESC/POS text commands. Full math and reasoning is in that file's comments — read it, don't re-derive it.
- `lib/rawbtPrint.ts` / `lib/silentPrint.ts` — the web app's other print paths, for context only (not used by this app).
- `components/school/SchoolKiosk.tsx` — the current web kiosk UI (893 lines). This is the UX you're porting: service-selection grid, priority toggle, ticket confirmation, recent-tickets rail, bilingual copy (`COPY.en` / `COPY.ar` objects at the top of the file — copy them verbatim, don't re-translate), print-queue-doesn't-block-next-tap behavior.

This app **replaces `android-kiosk/`** for the kiosk device. Do not delete `android-kiosk/` — leave it as a fallback/reference until this app is verified on real hardware.

---

## 1. Scope — what to build and what NOT to build

Two very different pieces. Do not blur them.

### 1a. Kiosk app (the real work) — build this fully native
Runs on a tablet mounted in the lobby. Touch-only, unattended, always-on.
- Service-selection grid → issue token → **print ticket via a directly-connected thermal printer** (Bluetooth SPP or USB — no RawBT, no other app in the loop).
- Recent-tickets rail, reprint, cancel, move-to-another-department, priority toggle — same actions the web kiosk has today.
- Bilingual EN/AR with RTL layout support.
- Auto-launch on boot, kiosk/lock-task mode, auto-recover from a crashed WebView-equivalent (there is none — it's native — but auto-recover from a network drop / API error the same way `MainActivity.kt` retries on page-load failure).

### 1b. Customer-facing pages — WebView embeds, NOT native rebuilds
`join`, `track`, `display` stay dynamic — wrap the **existing** web routes in an in-app WebView screen rather than reimplementing them in Dart. This is explicitly the cheap path the product owner chose; do not "improve" it into a native rebuild without being asked.
- `/join/[branchId]` → `app/(public)/join/[branchId]/page.tsx`
- `/track/[queueId]` → `app/(public)/track/[queueId]/page.tsx`
- `/display/[token]` → `app/(public)/display/[token]/page.tsx`

Give the app a bottom nav or a simple menu to switch between "Kiosk" and these WebView screens if the build target needs both in one binary; more likely these ship as **separate app targets/flavors** (kiosk tablet vs. a generic branded app) — confirm with whoever hands you this before assuming one APK does both.

### 1c. Waiting-area display board audio — a WebView flag, not a rebuild

The school board at `/school/display/[screenToken]` (`app/(school)/school/(device)/display/[screenToken]/page.tsx` → `components/school/SchoolBoard.tsx`) produces sound in two ways:

1. **TTS token announcements** — `lib/school/announce.ts` (`SchoolAnnouncer`). It speaks via `window.AndroidTTS` when that JS interface exists, otherwise Web Speech + a WebAudio chime.
2. **Opt-in video-ad audio** (added alongside this doc) — the right-side ad rail (`components/school/SchoolAdRail.tsx`) shows one ad at a time and unmutes a video when its ad has `audio_enabled` set (managed at `/school/ads`).

**On a plain browser both are blocked** until a user gesture — a wall-mounted TV never gets one, which is the "audio doesn't play on the TV" bug. `SchoolBoard.tsx` renders a full-screen "Tap anywhere to enable sound" curtain as the fallback, but nobody is there to tap it.

**The fix is on the app side, and it's small.** Whatever screen hosts the display board must:

- Set the WebView to allow autoplay with sound — `mediaPlaybackRequiresUserGesture = false`. The existing `android-kiosk/app/src/main/java/com/vibequeue/kiosk/MainActivity.kt` already does exactly this (around line 82) for the kiosk page; do the equivalent for the display. For `flutter_inappwebview`: `InAppWebViewSettings(mediaPlaybackRequiresUserGesture: false)`. Do not start the WebView/app muted.
- Inject a JS interface named `AndroidTTS` with a `speak(String)` method (see `MainActivity.kt` line ~84 and its `TtsInterface`), OR accept that the board falls back to Web Speech + chime. `SchoolAnnouncer` auto-detects `window.AndroidTTS` and treats audio as ready when it's present, so injecting it also removes the tap curtain.
- The display is almost certainly its **own app target / route**, separate from the ticket kiosk screen (different device, different token — `screen_token` not `branch_token`). Don't try to force both into one screen.

No web code needs to change for this — `SchoolBoard.tsx` / `SchoolAnnouncer` / `SchoolAdRail` already handle the "audio is unlocked" and "AndroidTTS present" paths. This is purely a WebView-configuration task for the app that wraps the page.

### Explicitly out of scope
- Staff/counter console (`app/(counter)`-equivalent, `schoolCallNextAction` etc.) — stays web-only, staff use a browser.
- Admin/manager dashboard (`app/(school)/school/(manage)/*`) — stays web-only.
- Any rewrite of `join`/`track`/`display` as native Flutter widgets — not requested, don't do it.

---

## 2. Architecture

```
Flutter app (new, native)                Next.js app (this repo, extend it)
┌─────────────────────────┐              ┌──────────────────────────────────┐
│ Kiosk screens (Dart)     │  HTTPS/JSON  │ NEW: app/api/kiosk/[branchToken]/ │
│  - service grid          │─────────────▶│  wraps EXISTING server actions:   │
│  - ticket render+print   │              │  lib/actions/school-tokens.ts     │
│  - recent rail           │              │  lib/actions/school-read.ts       │
├─────────────────────────┤              │  lib/dal/school.ts                │
│ WebView screens          │  loads URLs  ├──────────────────────────────────┤
│  - join/track/display    │─────────────▶│ EXISTING web routes, unchanged    │
└─────────────────────────┘              └──────────────────────────────────┘
         │
         ▼
  Bluetooth/USB ESC/POS thermal printer (raster mode)
```

Nothing about the Supabase schema, RLS, or existing web app changes. You are additive: new API routes on the Next.js side, a new Flutter project. Do not touch `components/school/SchoolKiosk.tsx` or any existing web page.

---

## 3. Backend: new API routes (build these first, in this repo)

**Auth model — already solved, don't invent a new one.** The kiosk authenticates the same way the web kiosk page does: an opaque per-branch `branch_token` in the URL (see `supabase/schema.sql:104`, `lib/actions/school-tokens.ts` → `verifySchoolBranch`). The Flutter app stores this token in its device config (set once during kiosk setup, e.g. a hidden settings screen or QR-code provisioning) and sends it on every request. **Every route must re-verify the token server-side against the `branches` table exactly like the existing actions do** — never trust a client-supplied branch id.

Create `app/api/kiosk/` route handlers. These are **thin wrappers around existing, already-correct business logic** — do not reimplement queue logic, do not touch RPCs directly if an action already wraps them. Each route below names the exact existing function to call.

### `GET /api/kiosk/[branchToken]/bootstrap`
Wraps `getSchoolKioskPacket(branchToken)` (in `lib/dal/school.ts:123`). Returns everything the app needs to boot: branch name, department list, settings (school name EN/AR, logo URL, ticket footer EN/AR, `print_enabled`, `languages`), `silentPrint`/`printerName` (informational only — the app manages its own printer connection, doesn't need these, but return them anyway for parity).

### `GET /api/kiosk/[branchToken]/feed`
Wraps `fetchSchoolKioskFeedAction(branchToken)` (`lib/actions/school-read.ts:154`, itself wraps `getSchoolKioskFeed` in `lib/dal/school.ts:290`). Returns `{ status, serviceDate, recent: SchoolTokenDTO[], waitingByDepartment: Record<deptId, number>, waitingTotal, issuedToday }`. **Poll this every 6 seconds** — that's the interval the web kiosk uses (`FEED_POLL_MS = 6000` in `SchoolKiosk.tsx`), match it so behavior is identical.

### `POST /api/kiosk/[branchToken]/tokens`
Body: `{ departmentId: string, isPriority?: boolean }`. Wraps `schoolIssueTokenAction(branchToken, departmentId, isPriority)` (`lib/actions/school-tokens.ts:123`). Returns `{ token: SchoolTokenDTO } | { error: string }`. This is the RPC `claim_school_token` under the hood — don't call it directly, go through the action.

### `POST /api/kiosk/[branchToken]/tokens/:id/cancel`
Wraps `schoolKioskCancelTokenAction`. Only valid for `waiting`/`held` tokens (server already enforces this — surface the error message as-is to the UI, don't re-derive the rule client-side).

### `POST /api/kiosk/[branchToken]/tokens/:id/priority`
Body: `{ isPriority: boolean }`. Wraps `schoolKioskSetPriorityAction`.

### `POST /api/kiosk/[branchToken]/tokens/:id/move`
Body: `{ departmentId: string }`. Wraps `schoolKioskMoveTokenAction`.

**Implementation notes for whoever builds this half:**
- Each existing action already does its own branch/token verification — the route handler's job is just: parse `branchToken` from the path, parse the body, call the action, serialize the result, set correct HTTP status (404 for "not-found" branch, 400 for validation errors, 200 otherwise). Don't add a second auth layer on top.
- Reuse the actions' TypeScript return types directly for the JSON shape — don't hand-write parallel interfaces that can drift.
- No new database access, no new RPCs. If a route needs data no existing action provides, that's a signal to add a thin new action next to the existing ones in `lib/actions/school-*.ts` (following their exact style — server-role client, branch-token verification, DTO mapping) rather than querying Supabase directly from the route handler.
- Rate limiting / abuse protection: out of scope for v1 (device is on a trusted LAN/token), but don't actively disable Next.js defaults.

---

## 4. Data models (Dart) — mirror these exactly

Source of truth: `lib/db/school-types.ts`. Field names below are the **camelCase DTO** shape (what the API returns), not the snake_case DB rows.

```dart
class SchoolTokenDTO {
  final String id, customerId, branchId, departmentId, serviceDate, tokenCode;
  final String? counterId, transferredFromDepartmentId;
  final int number, callCount, recallCount;
  final String status; // 'waiting'|'called'|'held'|'served'|'no-show'|'cancelled'
  final bool isPriority;
  final String source; // 'kiosk'|'staff'|'web'|'api'
  final String notes, joinedAt, createdAt;
  final String? calledAt, servedAt;
}

class SchoolDepartmentDTO {
  final String id, nameEn, nameAr, prefix, color, icon;
  final bool isPriority, isActive;
  final int displayOrder;
}

class SchoolSettingsDTO {
  final String schoolNameEn, schoolNameAr, logoUrl, ticketFooterEn, ticketFooterAr;
  final List<String> languages; // e.g. ['en','ar']
  final bool priorityEnabled, printEnabled;
  // kiosk_idle_seconds, announce_* fields exist on the settings row too —
  // include them if you build an idle/attract-screen or TTS announcements,
  // otherwise they're inert.
}

class SchoolKioskFeed {
  final String status; // 'ok'|'not-found'
  final String? serviceDate;
  final List<SchoolTokenDTO> recent;
  final Map<String, int> waitingByDepartment; // keyed by departmentId
  final int waitingTotal, issuedToday;
}
```

Check `lib/db/school-types.ts:182` (`SchoolTokenDTO`), `:257` (`SchoolKioskFeed`), and `lib/dal/school.ts:123` (`SchoolKioskPacket`, inline type — bootstrap response) for exact/current field lists before finalizing — this doc is a snapshot, the code is the source of truth if they've drifted.

---

## 5. Kiosk UI — port `SchoolKiosk.tsx`, don't redesign it

Read `components/school/SchoolKiosk.tsx` top to bottom before writing a single screen. Key behaviors to preserve, because they're deliberate fixes for real kiosk problems, not incidental:

- **The service grid never unmounts.** Issuing a token is a side effect shown in a side rail, not a page transition — because the next visitor can tap while the previous ticket is still printing. Model this as one persistent screen with a print queue, not a navigation stack.
- **Printing runs off a queue, and never blocks the next tap.** A `PrintJob` (token + department) is enqueued, printed asynchronously; the tap handler returns immediately.
- **Print failures never lose the ticket.** The token is already committed server-side (via the `POST /tokens` call) before printing starts — if the printer fails, the ticket number is still shown on screen and the visitor keeps it. Never make token issuance depend on print success.
- **Bilingual copy** — copy `COPY.en` / `COPY.ar` from the top of `SchoolKiosk.tsx` verbatim into your Dart localization, don't re-translate or paraphrase. Arabic requires RTL layout (`Directionality` widget / `TextDirection.rtl` in Flutter) — test both languages on real hardware, not just the emulator, since Arabic shaping bugs often only show up in real rendering.
- **Priority toggle** is a kiosk-side "arm the next ticket as priority" switch (`priorityArmed` state), not a per-tap parameter — check the component for exact interaction.
- **Recent-tickets rail**: last N tokens for the branch today (`RECENT_LIMIT = 30` in the web component), supports reprint/move/cancel per row.

---

## 6. Native printing — the highest-risk, highest-effort part

**Strategy: render-to-bitmap, same as the web app, not ESC/POS text mode.** This is not a style choice — it's required for the same three reasons `printTicket.ts` gives (per-tenant logo, Arabic shaping, exact dot math). Re-read `lib/school/printTicket.ts` before implementing; port its constants:

```
paperMm: 58        // roll width
printableMm: 48     // what the 384-dot head actually reaches
minHeightMm: 40      // floor, ticket is cut-to-length above that
rawbtDots: 384       // dots across — reuse as your raster width
tearFeedMm: 12        // blank feed after content so it clears the tear bar
                       // (drop to ~2 if the printer has an auto-cutter)
logoMaxMm: {width: 32, height: 14}
logoThreshold: 0.62   // luminance cutoff, dark below → black dot
```

Implementation shape:
1. Build the ticket as a Flutter widget (logo, school name EN/AR, token code big, department, footer text) sized to `printableMm` at whatever DPI maps 1:1 to the head's dots-per-mm (8 dots/mm here — same math as the web version's `dpmm` calc).
2. Capture it off-screen via `RepaintBoundary` → `toImage()` → raw pixels.
3. Convert to 1-bit monochrome using the same luminance-threshold approach as `prepareTicketLogo` in `printTicket.ts` (composite onto white first — don't let transparent PNG alpha read as black).
4. Encode as ESC/POS raster (`GS v 0` command) and send over the printer connection.
5. Send the trailing feed (`tearFeedMm`) as a paper-feed command, then (if the printer has one) a cut command — make the cut command a config flag per printer/branch, since not all hardware has an auto-cutter.

**Printer connectivity — the actual unknown.** Package candidates: `esc_pos_bluetooth` / `esc_pos_printer` (or raw `flutter_bluetooth_serial` / `usb_serial` + hand-rolled ESC/POS framing if those are unmaintained by the time you build this — check pub.dev freshness first). Needs, regardless of package:
- Printer pairing/selection UI, persisted per-device (shared prefs or similar) so it survives restarts.
- Reconnect-on-demand — a kiosk left on for days will have the printer sleep/disconnect; detect and reconnect transparently, don't require a human to re-pair.
- Paper-out / offline error surfaced on screen (there's nobody at an unattended kiosk to see a silent failure otherwise — the visitor needs to know their number even if it didn't print, mirroring the web app's `printFailed` copy: *"The printer is unavailable. Please note your number."*).
- **This cannot be fully speced without the actual printer hardware.** Get the make/model and connection type (Bluetooth SPP vs BLE vs USB) before estimating further; different cheap 58mm thermal printers vary a lot in ESC/POS raster command support.

---

## 7. Kiosk-mode device behavior (Android)

Port these from `android-kiosk/` (see §0), Flutter-native equivalents:
- Fullscreen, hide system bars — `SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky)`.
- Disable back button — intercept via `PopScope`/`WillPopScope`.
- Auto-launch on boot — Android boot receiver (native platform channel or a plugin like `android_alarm_manager_plus`/manual manifest edit in `android/app/src/main/`).
- Consider Android's built-in **Lock Task Mode / kiosk mode** (`startLockTask()`) if the device is dedicated hardware — stronger than just hiding system UI, prevents the visitor from ever leaving the app via recents/home.
- Retry-on-error: if `bootstrap`/`feed` calls fail (network drop), show a retry state and keep polling — don't crash to a blank screen, matching `MainActivity.kt`'s reload-on-error behavior.

---

## 8. Suggested build order

1. **Backend routes** (§3) — small, mechanical, unblocks everything else. Test with `curl` against a real branch token before writing any Dart.
2. **Flutter project scaffold** — new directory at repo root, e.g. `mobile/kiosk/` (confirm naming/location isn't already claimed — check for an existing empty `flutter_kiosk`/`mobile` dir first). `flutter create`, add networking (`http` or `dio`), state management (pick one — `provider`/`riverpod` is enough for this scope, don't over-engineer).
3. **Bootstrap + feed screens with mock/no printing** — get the service grid, token issuance, and polling working end-to-end against the real API, printing a debug placeholder (e.g. just show a dialog "printed") instead of touching hardware yet. Validates the whole data path before hardware is even in the room.
4. **Ticket rendering to bitmap** — build the widget-to-raster pipeline (§6 steps 1–3), verify visually (save the bitmap to a file and eyeball it) before wiring up a physical printer.
5. **Printer connectivity** — once physical hardware is available. This is where the real time risk lives; budget slack here.
6. **Kiosk-mode device behavior** (§7).
7. **WebView screens for join/track/display** (§1b) — cheap, do last, doesn't block the core kiosk flow.
8. **Soak test on the actual tablet/printer for at least a full day** before calling it done — unattended-hardware bugs (sleep, reconnect, memory growth from a long-lived polling loop) don't show up in a 10-minute dev session.

---

## 9. Open questions to resolve with the product owner before/while building

- Exact printer make/model and connection type (Bluetooth SPP/BLE vs USB) — blocks §6 estimation.
- Does one APK need both the kiosk UI and the join/track/display WebView screens, or are these separate app targets?
- Kiosk device provisioning: how does a new tablet get its `branch_token` on first boot — manual entry, QR scan, pre-baked build per branch?
- Auto-cutter present on the target printer or not (`tearFeedMm` behavior differs, see §6).
