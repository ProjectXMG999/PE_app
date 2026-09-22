import { describe, it, expect } from 'vitest'
import { nextRestoreStep } from './scrollRestore'

const MAX = 60

/** Drives the decision the way HomePage's rAF loop does, against a fake
 *  scroller whose height grows by `growth(frame)` pixels per frame. Returns how
 *  many frames it took and where it stopped — the two things that matter. */
function run(target: number, growth: (frame: number) => number, maxTries = MAX) {
  let height = 0
  let prev = -1
  let stalled = 0
  let tries = 0

  for (;;) {
    height += growth(tries)
    // What the browser does: writing past the end clamps to the maximum.
    const current = Math.min(target, height)
    const step = nextRestoreStep(target, current, prev, stalled, tries, maxTries)
    stalled = step.stalled
    prev = step.prev
    tries++
    if (step.done) return { tries, landedAt: current }
  }
}

describe('nextRestoreStep', () => {
  it('stops immediately when the offset is already reachable', () => {
    const { tries, landedAt } = run(500, () => 500)
    expect(tries).toBe(1)
    expect(landedAt).toBe(500)
  })

  // The bug. An offset the list can never reach used to burn the entire
  // 60-frame budget, each frame writing the same clamped value and reading it
  // back — a forced layout of a hundred-row list, sixty times, which at 60Hz is
  // the one-second stall on arriving at /pakiety.
  it('gives up two frames after the container stops growing', () => {
    let height = 0
    const { tries } = run(5000, () => {
      // Grows for three frames, then pinned — the common case, because
      // content-visibility placeholders make the list far shorter than the
      // saved offset.
      height += 1
      return height <= 3 ? 400 : 0
    })
    expect(tries).toBeLessThanOrEqual(6)
  })

  it('does NOT give up on a list that is still growing, however slowly', () => {
    // One pixel a frame is as gradual as it gets, and it must still be allowed
    // to run to the ceiling rather than being mistaken for a stall.
    const { tries } = run(5000, () => 1)
    expect(tries).toBe(MAX)
  })

  it('tolerates fractional scrollTop', () => {
    // On a non-integer DPR scrollTop reads back fractional. Exact equality
    // would never hold, so a naive detector would never fire — and a naive
    // "any change counts" one would never stall on sub-pixel noise either.
    const { tries } = run(5000, frame => (frame < 2 ? 100 : 0.1))
    expect(tries).toBeLessThanOrEqual(6)
  })

  it('never exceeds the ceiling', () => {
    expect(run(5000, () => 1, 10).tries).toBe(10)
    expect(run(5000, () => 0, 10).tries).toBeLessThanOrEqual(10)
  })

  it('lands where the abandoned frames would have left it', () => {
    // The correctness argument for stopping early: the frames we skip write the
    // same clamped value and read the same result back, so the position is
    // identical to what running the full budget would have produced.
    const stalling = (frame: number) => (frame < 3 ? 400 : 0)
    expect(run(5000, stalling).landedAt).toBe(run(5000, stalling, 1000).landedAt)
  })
})
