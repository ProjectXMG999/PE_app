import { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'

interface Props {
  /** The placeholder's tone class — "review", "train", "smart". Only ever seen
   *  before the first settle, and only as the ground the curtain stands on. */
  tone: string
  /** Has the session EVER been built? From `useSessionOpener`. */
  settled: boolean
  /** Is the curtain still up? From `useSessionOpener`. */
  openerVisible: boolean
  /** The curtain itself. Needs its own stable `key` for AnimatePresence. */
  opener: ReactNode
  /** The session screen. A function, not a node: it dereferences data that
   *  doesn't exist until `settled`, so it must not be evaluated before then. */
  children: () => ReactNode
}

/**
 * A study screen and the curtain over it.
 *
 * Four pages had written this out by hand, comment included, and the ordering
 * it encodes is not obvious enough to be retyped: the body renders on
 * `settled` rather than on the page's own readiness flag, because every one of
 * these sessions can rebuild mid-visit ("jeszcze raz", "Kontynuuj powtórkę")
 * and a body keyed on raw readiness blanks back to a placeholder under a
 * curtain that has already lifted.
 *
 * The placeholder is not a loading state — the curtain is. It only exists so
 * the ground behind a translucent page transition is the right colour.
 *
 * One thing this deliberately does NOT do is claim `ambientHidden`. It is
 * tempting: the shader runs behind the opaque curtain for its whole length,
 * and the iOS status band (which follows that same flag) shows the mesh's
 * colour over a flat screen until the curtain lifts. But claiming it at mount
 * unmounts the shader inside the entering view transition, and a WebGL
 * teardown there is the stall AppShell's own claim logic exists to avoid.
 * StudyStage keeps the claim, a beat later and off the animation's path.
 */
export function SessionStage({ tone, settled, openerVisible, opener, children }: Props) {
  return (
    <>
      {settled ? children() : <div className={`stage stage--${tone}`} />}
      <AnimatePresence>{openerVisible && opener}</AnimatePresence>
    </>
  )
}
