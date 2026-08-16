// Minimal offline-first service worker: cache everything the app requests
// (the shell plus hashed build assets), serve from cache, refresh in the
// background. Bump the version to invalidate old caches on deploy.
const CACHE = 'stoke-v1'

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
