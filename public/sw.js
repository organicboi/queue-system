const CACHE = "vibequeue-v1"
const PRECACHE = ["/", "/display", "/dashboard", "/icon.svg"]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return
  const url = new URL(e.request.url)
  // Skip cross-origin, API routes, and Next.js internals
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return
  // Never cache HTML navigation requests — always fetch fresh to avoid stale-chunk loops
  if (e.request.mode === "navigate") return

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
        }
        return res
      })

      if (cached) {
        // Background revalidation — swallow errors so they don't surface as unhandled rejections
        networkFetch.catch(() => {})
        return cached
      }
      return networkFetch
    })
  )
})

self.addEventListener("push", (e) => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title ?? "VibeQueue", {
      body: data.body,
      icon: data.icon ?? "/icon.svg",
    })
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow("/dashboard"))
})
