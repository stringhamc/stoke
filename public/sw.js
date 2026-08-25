// Offline support without stale-version pain:
// - navigations (the app shell) are NETWORK-FIRST, so a new deploy shows up
//   on the next online launch; the cache only answers when offline
// - hashed build assets are cache-first (their names change every build, so
//   a cached copy can never be stale)
// Bump the version to force old caches out on deploy.
const CACHE = 'stoke-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['.', 'manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(event.request, copy))
          }
          return res
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('.'))),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(event.request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached ?? fetched
    }),
  )
})
