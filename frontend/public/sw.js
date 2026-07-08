// Neuro Flow Service Worker v3
// Strategies: app-shell precache, stale-while-revalidate for pages,
// network-first for API, cache-first for static assets, offline fallback

const SHELL_CACHE   = "nf-shell-v3";
const DATA_CACHE    = "nf-data-v3";
const STATIC_CACHE  = "nf-static-v3";
const OFFLINE_URL   = "/offline.html";

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
];

// ── Install: precache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: prune old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const CURRENT = new Set([SHELL_CACHE, DATA_CACHE, STATIC_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: tiered strategy ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET or cross-origin: passthrough
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Offline page: always serve from cache
  if (url.pathname === OFFLINE_URL) {
    event.respondWith(caches.match(OFFLINE_URL));
    return;
  }

  // API: network-first → cache fallback (keeps data fresh, works offline)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: DATA_CACHE });
          return cached ?? new Response(
            JSON.stringify({ detail: "You are offline. Showing cached data." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  // Next.js static chunks / fonts: cache-first (immutable hashed names)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request, { cacheName: STATIC_CACHE }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML navigation: stale-while-revalidate → offline fallback
  if (request.mode === "navigate" || request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      caches.match(request, { cacheName: SHELL_CACHE }).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        }).catch(() => cached ?? caches.match(OFFLINE_URL));
        // Return cached immediately if available, revalidate in background
        return cached ?? fetchPromise;
      })
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((res) => {
        if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached ?? fresh;
    })
  );
});

// ── Background sync: retry queued API mutations ──────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "nf-sync-mutations") {
    event.waitUntil(replayQueuedMutations());
  }
});

async function replayQueuedMutations() {
  // Mutations queued by the frontend are stored in IDB under "nf-mutation-queue"
  // This is a lightweight version — just notifies clients to retry
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage({ type: "SYNC_COMPLETE" }));
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Neuro Flow", body: event.data.text() }; }

  const title   = payload.title   ?? "Neuro Flow";
  const options = {
    body:    payload.body    ?? "",
    icon:    payload.icon    ?? "/icon.svg",
    badge:   "/icon.svg",
    tag:     payload.tag     ?? "nf-notification",
    data:    payload.data    ?? {},
    actions: payload.actions ?? [],
    vibrate: [100, 50, 100],
    requireInteraction: payload.requireInteraction ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ── SW update message ─────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
