import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { RangeRequestsPlugin } from 'workbox-range-requests'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[]; skipWaiting(): void }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// On SW activate: drop audio cache so stale/bad responses don't persist across deploys
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('pe-audio-v1'))
})

// Pack JSON files: serve from cache, refresh in background
registerRoute(
  ({ url }) => url.pathname.startsWith('/data/packs/'),
  new StaleWhileRevalidate({
    cacheName: 'pe-packs-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// Audio via Netlify Function: CacheFirst with Range request support (iOS Safari)
registerRoute(
  ({ url }) => url.pathname.startsWith('/.netlify/functions/audio'),
  new CacheFirst({
    cacheName: 'pe-audio-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 600,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new RangeRequestsPlugin(),
    ],
  })
)
