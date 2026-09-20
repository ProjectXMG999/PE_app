import { useEffect, useRef, useState } from 'react'
import { observeOnce } from '../utils/inView'

/**
 * "Has this been scrolled to yet?" — for a block that should play its arrival
 * when it's looked at rather than when the page mounts.
 *
 * Postęp is a very long page: a bar animated on mount has always finished by
 * the time anyone reaches it, so the whole bottom two-thirds of the screen
 * arrives pre-assembled while only the hero ever animates. Several of these
 * components already carried a `transition: width` that, for exactly that
 * reason, had never once run.
 *
 * Usage — the ref goes on the element that has to come into view (the row, not
 * the bar inside it), and the flag picks the value:
 *
 *   const [ref, shown] = useRevealOnView<HTMLDivElement>()
 *   <div ref={ref}><span style={{ width: shown ? `${pct}%` : 0 }} /></div>
 *
 * One-shot by design: scrolling back up doesn't rewind it. Under reduced motion
 * it starts true, so nothing is ever held back from someone who asked for less
 * movement — they just get the final state immediately.
 */
export function useRevealOnView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    // Two frames before the real value, for the same reason the compass hero
    // needs them: the zero state has to be painted or there is nothing for the
    // CSS transition to move away from.
    return observeOnce(el, () => {
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    })
  }, [shown])

  return [ref, shown]
}
