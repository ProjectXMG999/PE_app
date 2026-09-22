/**
 * The black band along the bottom of the installed iOS app.
 *
 * With `apple-mobile-web-app-status-bar-style=black-translucent` WebKit draws
 * the page from y=0, under the status bar — which is the point, it is what puts
 * the app's own ground behind the clock and the Dynamic Island — but it still
 * reports a viewport height with the top inset already subtracted. Everything
 * here is sized off that height (html, body, #root and .appshell are all
 * `height: 100%`), so the last ~59px of the screen never gets painted and shows
 * as a black strip above the home indicator.
 *
 * Measure the difference and publish it as --ios-bottom-shim; global.css grows
 * the document by it and AmbientBackground.css lets the ground run into it.
 *
 * Gated on `navigator.standalone`, which is true only for an iOS home-screen
 * app. In a browser tab the same subtraction is the browser's own chrome, and
 * a shim there would push the page down behind it.
 */
export function measureIosViewportGap() {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (!nav.standalone) return

  const apply = () => {
    // screen.height is the portrait-orientation screen on iOS regardless of
    // how the device is held, and the manifest locks the installed app to
    // portrait, so the two are comparable here.
    const gap = Math.round(window.screen.height - window.innerHeight)
    // Only a plausible inset. Anything larger is a different phenomenon —
    // a rotation caught mid-measure, the software keyboard — and shoving the
    // layout down by a few hundred pixels would be far worse than the strip
    // this exists to remove.
    const shim = gap > 0 && gap <= 80 ? gap : 0
    document.documentElement.style.setProperty('--ios-bottom-shim', `${shim}px`)
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
}
