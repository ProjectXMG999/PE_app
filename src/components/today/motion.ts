import { Transition, Variants } from 'framer-motion'

/** Numeric equivalent of --ease-out-expo — framer-motion can't read CSS vars. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Numeric equivalent of --ease-spring, tuned to match the token's bounce. */
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 20 }

/** Critically damped and quick — selection indicators, press feedback. No bounce. */
export const SPRING_SNAPPY: Transition = { type: 'spring', stiffness: 600, damping: 40 }

/**
 * ── The choreography ────────────────────────────────────────────────────────
 * Two things now move when you open a page: the page itself (a view transition
 * — see navigation/transitions.ts) and the blocks inside it. Played at the same
 * instant they read as one blurred event; played in order they read as an
 * arrival. So the content waits out most of the page's own travel and then
 * settles into it.
 *
 * ENTER_DELAY is that wait, and it is the single number that keeps every screen
 * in the app in step — CSS pages read the same value from --pe-enter-delay in
 * animations.css. ENTER_STEP is the gap between siblings: enough to read as a
 * cascade, small enough that a six-block page is finished in a third of a
 * second. A screen you open daily should be ready, not performing.
 */
/* Exported because the curtain cascades by hand rather than through a variants
 * container — it reveals its lines on `ready` instead of on mount — and a
 * screen cascading on numbers of its own is exactly what these constants exist
 * to prevent. */
export const ENTER_DELAY = 0.06
export const ENTER_STEP = 0.06
export const ENTER_DURATION = 0.5

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { delayChildren: ENTER_DELAY, staggerChildren: ENTER_STEP },
  },
}

/** Between page groups — kept short: the page should be ready, not performing. */
export const staggerContainerWide: Variants = {
  hidden: {},
  show: {
    transition: { delayChildren: ENTER_DELAY, staggerChildren: ENTER_STEP },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO } },
}

/**
 * A short settle, no scale. It used to travel 22px and scale up from 0.97,
 * which made every visit to the page a small show; a screen you open daily
 * should just be there.
 *
 * Dzisiaj, which this was written for, took that argument the rest of the way
 * and no longer cascades: ten blocks animated from the main thread, on top of
 * the 107–250 ms it takes to mount the route, read as the page stuttering into
 * place. It arrives as one plane now — `.pe-arrive` in animations.css. What is
 * left here serves the lighter screens.
 */
export const heroReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO } },
}

/**
 * Same reveal as `heroReveal` but doubles as a stagger container, so a card
 * rises in AND cascades its own inner lines (each a `heroReveal` child).
 */
export const heroCard: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO, staggerChildren: ENTER_STEP },
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
  hidden: { y: 12 },
  show: { y: 0, transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO, staggerChildren: ENTER_STEP } },
}

/** `glassReveal` with the motion taken out — reduced-motion swap. It has no
 *  opacity to fade either, so glass simply appears at its final fog level. */
export const glassRevealReduced: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ENTER_STEP } },
}
