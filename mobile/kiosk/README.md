# VibeQueue School Kiosk (Flutter)

Native lobby-kiosk app for the school queue vertical. Replaces the WebView
wrapper in `../../android-kiosk/`. Full plan and build order:
[`docs/flutter-kiosk-plan.md`](../../docs/flutter-kiosk-plan.md).

## Run

```bash
flutter pub get
# against a local `next dev` on the host (emulator sees it as 10.0.2.2):
flutter run
# against a deployed backend:
flutter run --dart-define=KIOSK_BASE_URL=https://<your-deployment>
```

On first launch the **setup screen** asks for the server URL and the branch
token (same opaque token as the web kiosk URL, `branches.branch_token`). It is
persisted via `shared_preferences`; the app boots straight to the kiosk after.

## Layout

| Path | What |
| --- | --- |
| `lib/src/config/` | `KioskConfig` (persisted branch token + base URL), `AppConfig` constants |
| `lib/src/models/` | Dart mirrors of the camelCase DTOs from `lib/db/school-types.ts` |
| `lib/src/api/` | `KioskApi` — Dio client for the six `app/api/kiosk/[branchToken]/*` routes |
| `lib/src/state/` | riverpod providers: bootstrap, 6s feed poll, `PrintQueue`, `KioskController` |
| `lib/src/i18n/` | `COPY.en` / `COPY.ar` copied verbatim from `SchoolKiosk.tsx` |
| `lib/src/printing/` | `Printer` interface + `PrintQueue`; `DebugPrinter` logs until real printing lands |
| `lib/src/ui/` | setup screen, kiosk screen, grid / hero / rail widgets |

## What's done / not done

Done: backend routes, scaffold, data path (grid → issue token → hero + rail,
6s polling), bilingual RTL, non-blocking print queue with a `DebugPrinter`.

Not done: real end-to-end verification against a live branch token; the recent
rail's per-row reprint/move/cancel/priority actions (API methods exist, UI is
read-only); render-to-bitmap ticket + real printer transport (see §6 — target is
likely a **ZY307 80 mm** network/USB printer, not 58 mm Bluetooth); kiosk/lock-task
mode + boot receiver (§7); WebView screens for join/track/display (§1b).
