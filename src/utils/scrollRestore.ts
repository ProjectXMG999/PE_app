/**
 * When to stop trying to restore a scroll offset.
 *
 * Restoring an offset into a list that is still growing takes several frames:
 * `.packcard` uses `content-visibility: auto` with a 92px `contain-intrinsic-size`
 * (HomePage.css), so on a fresh mount every off-screen row claims a placeholder
 * height and the container is far shorter than the saved offset. Writing
 * `scrollTop` clamps to the current maximum, which renders the rows around it at
 * their real height, which grows the container — so the next frame can go a
 * little further.
 *
 * The bug this exists to fix is what happens when that stops working. A volume
 * holds 52–102 packs and a wrapped Polish title is taller than 92px, so the
 * shortfall is hundreds to thousands of pixels; the offset is often simply
 * unreachable. Once pinned at the clamp the rendered set stops changing, growth
 * goes to zero, and the loop spends its remaining budget writing the same value
 * and reading it back — and reading `scrollTop` right after writing it forces a
 * synchronous layout of a hundred-row list. At the old fixed budget of 60
 * frames that is a full second of blocked main thread on arrival at /pakiety,
 * which is exactly the "initial one-second crush" this was reported as.
 *
 * The insight that makes stopping safe: **frames after growth stalls are
 * provably no-ops.** They write the same clamped value and read the same result
 * back. Stopping early lands on precisely the position the remaining frames
 * would have produced.
 */

export interface RestoreStep {
  /** Stop asking for frames — either arrived, or provably not going to. */
  done: boolean
  /** Consecutive frames that produced no forward progress. */
  stalled: number
  /** `current`, to compare the next frame against. */
  prev: number
}

/** Frames without progress before we call it: two, not one. A single
 *  zero-growth frame happens naturally when a font or an image lands a frame
 *  late, and growth resumes right after. Two costs one extra frame in the bad
 *  case and removes the false positive entirely. */
const STALL_FRAMES = 2

/** `scrollTop` is fractional on a non-integer device pixel ratio, so exact
 *  equality would never hold and the stall would never be detected. */
const PROGRESS_EPSILON = 0.5

/** Close enough to the target to call it arrived. */
const ARRIVED_EPSILON = 2

/**
 * @param target   the offset we are trying to reach
 * @param current  `scrollTop` as it reads back after being written this frame
 * @param prev     what it read back last frame (-1 on the first)
 * @param stalled  consecutive no-progress frames so far
 * @param tries    frames spent so far
 * @param maxTries hard ceiling — protects the genuinely-long-list case, where
 *                 growth is gradual and the stall detector never fires
 */
export function nextRestoreStep(
  target: number,
  current: number,
  prev: number,
  stalled: number,
  tries: number,
  maxTries: number,
): RestoreStep {
  if (Math.abs(current - target) <= ARRIVED_EPSILON) return { done: true, stalled, prev: current }

  const grew = current > prev + PROGRESS_EPSILON
  const nextStalled = grew ? 0 : stalled + 1

  return {
    done: nextStalled >= STALL_FRAMES || tries + 1 >= maxTries,
    stalled: nextStalled,
    prev: current,
  }
}
