import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the user has asked the OS for less motion, kept live if they change
 * the setting while the page is open.
 *
 * This exists so the landing doesn't pull in framer-motion for its one hook —
 * ~50KB of animation runtime on a page whose only JS-driven motion is GSAP.
 * The app can keep using framer-motion's version; this is the same contract.
 *
 * Note the several places that check the query imperatively instead (GSAP
 * reveals, the Hero timeline): those run once inside an effect and never need
 * to re-render, so subscribing would be pointless work.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
