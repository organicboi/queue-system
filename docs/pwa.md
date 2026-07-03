# Progressive Web App (PWA)

VibeQueue ships as an installable PWA — no app store required. When the browser detects the site meets installability criteria, an **Install** prompt appears automatically so users can add the app to their home screen or desktop.

---

## How it works end-to-end

```
Browser fires beforeinstallprompt
        │
        ▼
usePWAInstall.ts   ← captures & stores the event (module singleton)
        │
        ├──▶ InstallPrompt.tsx   (floating banner, global — all pages)
        │
        └──▶ TopBar.tsx          (Install App button — admin panel only)
```

1. The browser fires `beforeinstallprompt` when the installability checklist passes (manifest present, SW registered, HTTPS, not already installed).
2. `usePWAInstall` intercepts and defers the event so the native browser prompt doesn't appear immediately.
3. Any component using the hook gets a `canInstall: true` flag and an `install()` function.
4. Calling `install()` triggers the deferred prompt, waits for the user's choice, and clears the prompt if accepted.

---

## Files

| File | Role |
|---|---|
| [app/manifest.ts](../app/manifest.ts) | Next.js manifest route — serves `/manifest.webmanifest` |
| [public/sw.js](../public/sw.js) | Service worker — caching + push notifications |
| [components/shared/PWARegister.tsx](../components/shared/PWARegister.tsx) | Registers the SW on first render (runs in root layout) |
| [hooks/usePWAInstall.ts](../hooks/usePWAInstall.ts) | Captures `beforeinstallprompt`, exposes `canInstall` + `install()` |
| [components/display/InstallPrompt.tsx](../components/display/InstallPrompt.tsx) | Floating install banner shown on every page |
| [components/admin/TopBar.tsx](../components/admin/TopBar.tsx) | Install App button in the admin top bar |

---

## Web App Manifest

Served automatically by Next.js at `/manifest.webmanifest` via `app/manifest.ts`.

```ts
{
  name: "VibeQueue",
  short_name: "VibeQueue",
  description: "Queue management platform for businesses",
  start_url: "/",
  display: "standalone",       // hides browser chrome when installed
  background_color: "#030712",
  theme_color: "#6366F1",      // indigo — matches brand
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
  ]
}
```

`display: "standalone"` is what makes the browser consider the site installable (required field alongside a registered service worker).

---

## Service Worker (`public/sw.js`)

Registered by `PWARegister` with `updateViaCache: "none"` so stale SW files are never served from the HTTP cache.

### Cache strategy

| Request type | Strategy |
|---|---|
| `/_next/*` internals | **Bypass** — never cached |
| `/api/*` routes | **Bypass** — never cached |
| Navigation (`mode: navigate`) | **Network-only** — always fetches fresh HTML to avoid stale-chunk loops after deploys |
| Everything else (assets, pages) | **Stale-while-revalidate** — serves cached copy instantly, revalidates in background |

### Events handled

| Event | Behaviour |
|---|---|
| `install` | Pre-caches `/`, `/display`, `/dashboard`, `/icon.svg` then calls `skipWaiting()` |
| `activate` | Deletes old cache versions, calls `clients.claim()` |
| `fetch` | Stale-while-revalidate (see above) |
| `push` | Shows a system notification (`data.title`, `data.body`, `data.icon`) |
| `notificationclick` | Opens `/dashboard` |

Cache key: `vibequeue-v1`. Bump this string in `sw.js` to invalidate all cached assets on the next deploy.

---

## `usePWAInstall` hook

Located at [hooks/usePWAInstall.ts](../hooks/usePWAInstall.ts).

### Module-level singleton

The `beforeinstallprompt` event fires once per page load, often before any React component mounts. The hook stores it in a **module-level variable** (`_deferredPrompt`) so it isn't lost between re-renders or between different component instances.

```ts
const { canInstall, install } = usePWAInstall()
```

| Return value | Type | Description |
|---|---|---|
| `canInstall` | `boolean` | `true` when the deferred prompt is available and the app is not already installed |
| `install()` | `() => Promise<boolean>` | Triggers the native install prompt; returns `true` if the user accepted |

### Already-installed detection

On mount, the hook checks `window.matchMedia("(display-mode: standalone)")` and `(display-mode: fullscreen)`. If either matches, the app is already running as an installed PWA and `canInstall` stays `false`.

### Listener pattern

Multiple components (e.g. `InstallPrompt` and `TopBar`) can use the hook simultaneously. Each registers a callback in `_listeners`; when the prompt state changes (captured or cleared after install), all listeners are notified synchronously.

---

## Install UI — where the button appears

### 1. Floating banner (`InstallPrompt`)

Rendered in `app/layout.tsx` — visible on **every page** of the app.

- Fixed to the bottom-center of the viewport (`fixed bottom-6 left-1/2 -translate-x-1/2`).
- Shows only when `canInstall` is `true` and the user hasn't dismissed it this session.
- Dismiss (✕) hides it for the current session via local `dismissed` state (not persisted).
- Clicking **Install** calls `install()` and auto-dismisses if the user accepted.

### 2. Admin TopBar button

Rendered in `components/admin/TopBar.tsx` — visible only inside the **admin panel** (`/dashboard`, `/branches`, etc.).

- Appears as an outlined `Install App` button (with Download icon) in the top-right of the header.
- Hidden on small screens (`<span class="hidden sm:inline">`), icon-only on mobile.
- Driven by the same `usePWAInstall` hook — no duplicate prompt logic.

---

## Browser support

The `beforeinstallprompt` event is a Chromium-only API (Chrome, Edge, Samsung Internet, Opera). Safari and Firefox do not fire it.

| Browser | Install prompt | Manual install |
|---|---|---|
| Chrome / Edge (desktop) | Automatic banner | Address bar install icon |
| Chrome (Android) | Automatic banner | Browser menu |
| Safari (iOS) | Not supported | Share → Add to Home Screen |
| Firefox | Not supported | Not supported |

On iOS/Safari the `InstallPrompt` banner will never appear (`canInstall` is always `false`). Users must install manually via the Share sheet.

---

## Updating the PWA

| Change | What to do |
|---|---|
| App shell content changed | Bump `CACHE` name in `public/sw.js` (e.g. `vibequeue-v2`) |
| Manifest fields changed | Edit `app/manifest.ts` — no SW change needed |
| Pre-cached routes changed | Update the `PRECACHE` array in `public/sw.js` |
| Icons changed | Replace `/public/icon.svg`; bump cache version |

The SW's `activate` handler automatically deletes caches whose key doesn't match the current `CACHE` constant, so old cached files are cleaned up on the user's next visit after the SW updates.

---

## Adding a new page to the pre-cache

Edit the `PRECACHE` array in [public/sw.js](../public/sw.js):

```js
const PRECACHE = ["/", "/display", "/dashboard", "/icon.svg", "/your-new-page"]
```

Then bump the `CACHE` version so the new pre-cache list takes effect.
