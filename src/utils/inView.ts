/**
 * One IntersectionObserver for everything in the app that animates on arrival,
 * not one per component.
 *
 * Postęp alone has a few dozen figures and bars spread down a very long page;
 * an observer each means a few dozen observers watching the same scroller. One
 * shared observer, callbacks keyed by element, and each element is dropped the
 * moment it fires — every use of this is one-shot.
 *
 * The root is the viewport rather than the app's scroll container: the
 * container scrolls *inside* the viewport, so anything crossing into view
 * crosses the viewport too, and none of the callers need a reference to the
 * scroller. The bottom margin fires slightly before an element's own bottom
 * edge clears the fold, so its animation is already under way by the time it
 * settles into reading position.
 */
const pending = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | null = null

/** Run `onSeen` the first time `el` is scrolled into view. Returns a cancel. */
export function observeOnce(el: Element, onSeen: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onSeen()
    return () => {}
  }
  observer ??= new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer?.unobserve(entry.target)
        const fire = pending.get(entry.target)
        pending.delete(entry.target)
        fire?.()
      }
    },
    { rootMargin: '0px 0px -10% 0px' }
  )
  pending.set(el, onSeen)
  observer.observe(el)
  return () => {
    observer?.unobserve(el)
    pending.delete(el)
  }
}
