import { describe, it, expect } from 'vitest'
import { refreshDelayFor } from './useProgressPulse'

const DEBOUNCE = 250
const QUIET = 15_000

/**
 * The always-visible streak/points pill refreshes by reading every wordProgress
 * row off the main thread. A plain debounce coalesced bursts but not a steady
 * cadence, so a learner answering a card every ~3 s paid for a full refresh per
 * card. These pin the policy that replaced it.
 */
describe('refreshDelayFor', () => {
  it('refreshes at once on a boundary the user can point at', () => {
    // Finishing a session, a pack completing, a level declaration, a sign-in
    // merge. Nobody should watch a number fail to move after one of these.
    for (const kind of ['session', 'package', 'reset', 'reviewLedger'] as const) {
      expect(refreshDelayFor(kind, 10_000, 0)).toBe(DEBOUNCE)
    }
  })

  it('holds a single rated card back to the quiet interval', () => {
    expect(refreshDelayFor('word', 0, 0)).toBe(QUIET)
    expect(refreshDelayFor('dailyTime', 0, 0)).toBe(QUIET)
  })

  it('counts the quiet interval from the last refresh, not from the event', () => {
    // 12s since the last refresh leaves 3s to wait, not a fresh 15.
    expect(refreshDelayFor('word', 12_000, 0)).toBe(3_000)
  })

  it('never waits less than the debounce, even long past the interval', () => {
    // Otherwise a burst of writes after a quiet spell would each refresh.
    expect(refreshDelayFor('word', 60_000, 0)).toBe(DEBOUNCE)
  })

  /**
   * The one that would silently regress. A bulk declaration ("Znam wszystko",
   * level mastery) writes its words and THEN the package — so the trailing
   * `package` has to pull the refresh forward to the debounce rather than
   * inheriting the long fuse the `word` events just booked. Paired with the
   * earliest-deadline rule at the call site, this is what keeps every bulk
   * path immediate while the per-card drip stays cheap.
   */
  it('lets a package landing after a word pull the refresh forward', () => {
    const wordDelay = refreshDelayFor('word', 1_000, 0)
    const packageDelay = refreshDelayFor('package', 1_000, 0)
    expect(packageDelay).toBeLessThan(wordDelay)
    expect(packageDelay).toBe(DEBOUNCE)
  })
})
