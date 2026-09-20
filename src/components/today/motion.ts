import { Transition, Variants } from 'framer-motion'

/** Numeric equivalent of --ease-out-expo — framer-motion can't read CSS vars. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Numeric equivalent of --ease-spring, tuned to match the token's bounce. */
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 20 }

/** Critically damped and quick — selection indicators, press feedback. No bounce. */
export const SPRING_SNAPPY: Transition = { type: 'spring', stiffness: 600, damping: 40 }

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
}

/** Between page groups — kept short: the page should be ready, not performing. */
export const staggerContainerWide: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
}

/**
 * Dzisiaj's entrance — a short settle, no scale. It used to travel 22px and
 * scale up from 0.97, which made every visit to the page a small show; a screen
 * you open daily should just be there.
 */
export const heroReveal: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
}

/**
 * Same reveal as `heroReveal` but doubles as a stagger container, so a card
 * rises in AND cascades its own inner lines (each a `heroReveal` child).
 */
export const heroCard: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT_EXPO, staggerChildren: 0.05 },
  },
}

/** Same shape, zero motion — swapped in under prefers-reduced-motion. */
export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
}

/**
 * Entrance for anything that IS or CONTAINS a backdrop-filtered surface
 * (`.u-liquid`, `.u-surface--raised`) — the same rise as `heroReveal`, with the
 * opacity channel deliberately absent.
 *
 * A group opacity below 1 makes the element composite its *blurred* backdrop at
 * partial alpha over the unblurred real one, so a glass card that fades in
 * looks like its fog thickens as it lands: on arrival the aurora reads through
 * almost sharp, a third of a second later it is at the full 28px of
 * --liquid-blur. On Dzisiaj, where nearly every block is glass, that was
 * visible as the whole page quietly frosting over after it had already
 * arrived. Pakiety never showed it because nothing inside its entrance carries
 * a backdrop-filter. Moving only on the transform channel keeps one fog level
 * from the first frame.
 *
 * Doubles as a stagger container (like `heroCard`) so a glass card can still
 * cascade its own children.
 */
export const glassReveal: Variants = {
  hidden: { y: 8 },
  show: { y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO, staggerChildren: 0.05 } },
}

/** `glassReveal` with the motion taken out — reduced-motion swap. It has no
 *  opacity to fade either, so glass simply appears at its final fog level. */
export const glassRevealReduced: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
