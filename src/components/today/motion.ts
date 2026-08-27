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

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
}

/** Same shape, zero motion — swapped in under prefers-reduced-motion. */
export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
}
