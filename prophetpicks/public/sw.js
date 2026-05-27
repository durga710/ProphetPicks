/* ProphetPicks service worker — minimal app-shell cache.
 *
 * Strategy:
 *  - install   : pre-cache the shell (HTML + favicon + manifest).
 *  - activate  : take control of clients immediately; trim old caches.
 *  - fetch     :
 *      - same-origin /assets/* hashed bundles -> cache-first (immutable).
 *      - same-origin / (the shell HTML)       -> network-first w/ cache fallback.
 *      - everything else                       -> pass-through to network.
 *
 * API calls (/api/...) are NEVER cached here — they have their own
 * Cache-Control headers on Vercel's edge. We don't want to serve stale
 * scores or odds offline.
 */

const VERSION = 'prophetpicks-shell-v1'
const SHELL = '/'
const PRECACHE = [SHELL, '/manifest.webmanifest', '/favicon.svg', '/prophet-mask.webp']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).catch(() => {
      // Ignore network errors during install; SW will catch up on first fetch.
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }
  const url = new URL(request.url)

  // Never intercept API calls.
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Skip cross-origin requests (logos from a.espncdn.com, news thumbs, etc.).
  if (url.origin !== self.location.origin) {
    return
  }

  // Hashed /assets/* are immutable -> cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
            return response
          }),
      ),
    )
    return
  }

  // The shell HTML and other same-origin GETs -> network-first.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request) ?? caches.match(SHELL)),
  )
})
