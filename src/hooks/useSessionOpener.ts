import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { playSessionCurtain } from '../services/sfx'

/** How long the curtain holds once it has something to say. */
export const OPENER_MIN_MS = 1200

export interface SessionOpenerState {
  /** Is the curtain on screen? True from mount, goes false once, never back. */
  visible: boolean
  /** Has the session EVER been ready? Latched, so a mid-visit rebuild (a
   *  "jeszcze raz", a "kontynuuj") can't drop the page back to a placeholder.
   *  Also what the curtain shows its content on — see the note below. */
  settled: boolean
  /** The curtain is on its way out — true from the frame the lift is decided,
   *  which is also the frame the fade starts.
   *
   *  This is the cue for the stage's own entrances. The body mounts on
   *  `settled` (the layout has to exist and be measured before the reveal),
   *  but for the rest of the hold it sits behind an opaque screen — and it was
   *  spending that time PLAYING: the first card ran its `card-enter` 3D
   *  transform and the progress track its glow, invisibly, in exactly the
   *  frames the curtain was animating. Two compositor jobs for one visible
   *  result, and the card's arrival was never actually seen by anyone. Keyed
   *  on this instead, it arrives into the fade. */
  lifting: boolean
  /** Tap-to-skip. Deliberately inert until `settled` — skipping through to an
   *  unbuilt session would reveal an empty stage. */
  dismiss: () => void
}

/**
 * The curtain's timing, shared by every study mode.
 *
 * The curtain is not a decoration laid over a finished screen — it IS the
 * loading state. It goes up on entry, the session builds under it, and it lifts
 * once there is something to open onto. That inverts what reduced motion means
 * here: the preference can't remove a screen that is load-bearing, so it
 * removes the *delay* (minMs 0) and the animation (SessionOpener reads the same
 * preference) instead.
 *
 * **The hold is measured from `settled`, not from mount.** Measuring it from
 * mount meant a session that took longer than the hold to build lifted its
 * curtain on the very frame the title finally appeared — the card flashed up
 * and was already fading out, which is worse than no curtain at all. The
 * minimum exists to give the content a moment on screen, so it can only start
 * counting once there is content.
 *
 * Both exposed flags are one-way. `useReviewSet` / `useSmartSession` rebuild on
 * a nonce without ever setting `loading` back to true, so a `visible` derived
 * from `ready` would happen to work today and break the first time someone
 * tidies those hooks up — and the failure mode, a curtain dropping over a
 * session already in progress, is the worst one this component has.
 */
export function useSessionOpener(
  ready: boolean,
  opts: { minMs?: number; level?: number | null } = {},
): SessionOpenerState {
  const reduced = useReducedMotion()
  const minMs = opts.minMs ?? (reduced ? 0 : OPENER_MIN_MS)

  // The curtain sounds on MOUNT, not on `lifting`. The hold is over a second
  // long, so a sound at the lift would arrive that long after the tap that
  // caused it and read as unrelated to it; fired here it swells under the title
  // card and resolves as the card leaves. Mount is also the moment closest to
  // the gesture, which is what unlocked the audio context in the first place.
  //
  // Latched, because StrictMode runs this effect twice and two curtains 0ms
  // apart is one curtain at double the gain, phase-cancelling in places.
  const soundedRef = useRef(false)
  const level = opts.level
  useEffect(() => {
    if (soundedRef.current) return
    soundedRef.current = true
    playSessionCurtain(level)
    // Mount only: `level` is read once, and a pack whose level resolves late
    // must not re-trigger the sound. Intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seeded from the first render so a warm cache settles without a second
  // commit; the effect covers everything that arrives later. Never set false.
  const [settled, setSettled] = useState(ready)
  const [minElapsed, setMinElapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (ready) setSettled(true)
  }, [ready])

  useEffect(() => {
    if (!settled) return
    if (minMs === 0) { setMinElapsed(true); return }
    const t = window.setTimeout(() => setMinElapsed(true), minMs)
    return () => window.clearTimeout(t)
  }, [settled, minMs])

  // Latched during render rather than in an effect: an effect-based latch costs
  // a commit, and under reduced motion (minMs 0) that commit is a visible frame
  // of curtain on a screen that asked for none. The write is monotonic, so
  // StrictMode's double render is a no-op.
  // `settled &&` is what makes `dismiss` inert before there is a session: a tap
  // on the bare ground is ignored rather than revealing an empty stage.
  const liftedRef = useRef(false)
  if (settled && (dismissed || minElapsed)) liftedRef.current = true

  const dismiss = useCallback(() => setDismissed(true), [])

  // `lifting` and `visible` flip on the same render: the curtain is still
  // painted (AnimatePresence is running its exit) while the stage underneath
  // begins to arrive, so the two cross rather than queue.
  return { visible: !liftedRef.current, lifting: liftedRef.current, settled, dismiss }
}
