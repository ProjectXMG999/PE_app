import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { RangeRequestsPlugin } from 'workbox-range-requests'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[]; skipWaiting(): void }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/**
 * Answer every in-app navigation with the precached shell.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 * `precacheAndRoute` installs a route that matches a request URL against the
 * precache: the URL itself, the URL minus utm params, `url + "index.html"` when
 * the path ends in a slash, and `url + ".html"`. None of those is `/dzis` —
 * which is this app's `start_url`, the address the home-screen shortcut opens.
 * So the manifest held 94 entries and 1.7 MB of the app, and the one request
 * that had to succeed fell through to the network every single time, to be
 * answered by Netlify's SPA redirect with an index.html the device already had.
 *
 * Measured on the production build before this existed: the service worker
 * installed, took control, precached all 94 entries — and an offline relaunch
 * of `/dzis` failed outright with ERR_INTERNET_DISCONNECTED, as did a deep link
 * to `/pakiety`. An installed, fully cached app that cannot open without a
 * network. `injectManifest` does not add this for you; only `generateSW` does,
 * which is why it went missing when the worker became a hand-written one.
 *
 * ── Why a denylist at all ───────────────────────────────────────────────────
 * `NavigationRoute` only matches `request.mode === 'navigate'`, so the function
 * calls the app makes with `fetch` were never at risk. The two entries are for
 * the case of a real navigation: `/.netlify/` so a function that answers with a
 * document (or a redirect to one) is never shadowed by the shell, and the
 * extension pattern so that typing a path to an actual file gets that file
 * rather than HTML pretending to be it. Stripe needs nothing here — those are
 * cross-origin, and a service worker does not see them.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/\.netlify\//, /\/[^/?]+\.[^/?]+$/],
}))

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
