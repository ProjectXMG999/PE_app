import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { RangeRequestsPlugin } from 'workbox-range-requests'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[]; skipWaiting(): void }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Pack content is now paywalled (served via the authenticated pack-content
// function, Cache-Control: private, max-age=0) — deliberately NOT cached here,
// so access re-locks immediately on cancellation instead of serving stale
// cached content to a lapsed subscriber.

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
