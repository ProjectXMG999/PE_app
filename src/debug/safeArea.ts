/**
 * DEV-only: puts a fake Dynamic Island on a desktop browser.
 *
 * `env(safe-area-inset-*)` is engine-only — no browser lets you set it, and no
 * emulated device profile in DevTools or Playwright reports a non-zero one. So
 * every safe-area bug in this app has historically only been findable on a
 * physical iPhone, which is how the bottom nav shipped 34px inside the home
 * indicator's gesture zone and the Konstelacja shipped with its Zamknij button
 * under the top bar. This is the cheapest possible substitute: redefine the
 * tokens the app reads through (--safe-top/-bottom/-left/-right) on an
 * attribute, and every rule that goes via var() moves with them.
 *
 * It only affects code that reads the tokens, which makes it a completeness
 * check as well — anything still writing env(safe-area-inset-*) inline stays
 * at zero here and stands out immediately.
 *
 *   ?safe=59   fake a 59px island plus a 34px home indicator
 *   ?safe=0    off
 *   window.__safe(59) / window.__safe(0)   same, at any time
 *
 * The query-string form is the one Playwright wants: the override is in place
 * for the FIRST paint, so screenshots never catch a pre-override frame.
 *
 * Module body is DEV-guarded, so the bundler drops this file from production —
 * same pattern as debug/seedProgress.ts and debug/devAutoLogin.ts.
 */
if (import.meta.env.DEV) {
  const STYLE_ID = 'safe-area-debug'

  const set = (px: number) => {
    const el = document.documentElement
    if (!px) {
      el.removeAttribute('data-safe-debug')
      document.getElementById(STYLE_ID)?.remove()
      return
    }
    let style = document.getElementById(STYLE_ID)
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    // html[data-safe-debug] is (0,1,1) against tokens.css's :root (0,1,0), so
    // it wins wherever this <style> lands in the cascade order.
    // 34px is the real iPhone home-indicator inset — the bottom nav and
    // .stage__actions deserve to be in the same screenshot as the island.
    style.textContent =
      `html[data-safe-debug]{` +
      `--safe-top:${px}px;--safe-left:${px}px;--safe-right:${px}px;--safe-bottom:34px;}`
    el.setAttribute('data-safe-debug', String(px))
  }

  const q = new URLSearchParams(location.search).get('safe')
  if (q !== null) set(q === '1' ? 59 : Number(q) || 0)

  ;(window as unknown as { __safe: (px: number) => void }).__safe = set
}
