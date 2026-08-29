import { Transition, Variants } from 'framer-motion'

/** Numeric equivalent of --ease-out-expo — framer-motion can't read CSS vars. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Numeric equivalent of --ease-spring, tuned to match the token's bounce. */
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 20 }

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07 },
  },
}

/** Wider stagger for places where the cascade itself is the effect. */
export const staggerContainerWide: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.13, delayChildren: 0.05 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
}

/**
 * Bolder entrance — more travel + a touch of scale so each line clearly rises
 * into place rather than just fading. Used on Dzisiaj where the motion is meant
 * to be felt, not only sensed.
 */
export const heroReveal: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
}

/**
 * Same reveal as `heroReveal` but doubles as a stagger container, so a card
 * rises in AND cascades its own inner lines (each a `heroReveal` child).
 */
export const heroCard: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO, staggerChildren: 0.09, delayChildren: 0.08 },
  },
}

/** Same shape, zero motion — swapped in under prefers-reduced-motion. */
export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
}
