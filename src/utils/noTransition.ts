/**
 * Suspend the app's universal colour transition for a window of time.
 *
 * `global.css` puts `transition: background-color, border-color, color` on
 * `*, *::before, *::after` — every element and both pseudo-elements in the
 * document. That is what makes a theme flip glide, and it is also billed on
 * every style recalculation of every freshly mounted tree: measured at
 * 178–341 ms of `UpdateLayoutTree` per tab-to-tab navigation on a phone-class
 * CPU. `.no-transition` (global.css) is the existing escape hatch.
 *
 * Two callers now want it — the theme flip in App.tsx and every page
 * navigation — and they overlap: a navigation ending mid-theme-flip must not
 * uncork the flip's transitions, or the new palette smears in over 250 ms
 * instead of cutting. So the class is reference counted and only the last
 * release actually removes it.
 */

let held = 0

/**
 * Add `.no-transition` to <html> and return the release for this hold.
 *
 * The returned function is idempotent — calling it twice releases once — so a
 * caller that both times out and completes can call it from either path.
 */
export function holdNoTransition(): () => void {
  if (held++ === 0) document.documentElement.classList.add('no-transition')
  let released = false
  return () => {
    if (released) return
    released = true
    if (--held === 0) document.documentElement.classList.remove('no-transition')
  }
}

/**
 * The same, released two frames later — one frame for the attribute or the
 * commit to apply, one for the style to settle, which is the shape App.tsx's
 * theme flip has always used.
 */
export function holdNoTransitionForAFrame(): void {
  const release = holdNoTransition()
  requestAnimationFrame(() => requestAnimationFrame(release))
}
