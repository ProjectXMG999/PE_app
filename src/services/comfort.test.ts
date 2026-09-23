import { describe, it, expect } from 'vitest'
import { COMFORT, updateComfort, strongStreakNext, shouldPromptLevelUp, sessionRatio, comfortFit, COMFORT_FIT_ORDER } from './comfort'

describe('sessionRatio', () => {
  it('is null below MIN_RATED — too short a session to read anything into', () => {
    expect(sessionRatio({ ratedCount: COMFORT.MIN_RATED - 1, knownHitCount: 999 })).toBeNull()
  })

  it('is the plain hit ratio at/above MIN_RATED', () => {
    expect(sessionRatio({ ratedCount: 10, knownHitCount: 8 })).toBe(0.8)
  })
})

describe('updateComfort', () => {
  it('leaves comfort untouched for a too-short session', () => {
    expect(updateComfort(2.0, { ratedCount: 2, knownHitCount: 2 })).toBe(2.0)
  })

  it('nudges up on a ratio above TARGET, down on a ratio below it', () => {
    const up = updateComfort(2.0, { ratedCount: 10, knownHitCount: 10 }) // ratio 1.0 > 0.8
    const down = updateComfort(2.0, { ratedCount: 10, knownHitCount: 4 }) // ratio 0.4 < 0.8
    expect(up).toBeGreaterThan(2.0)
    expect(down).toBeLessThan(2.0)
  })

  it('never moves more than MAX_STEP in one session', () => {
    const up = updateComfort(2.0, { ratedCount: 20, knownHitCount: 20 })
    const down = updateComfort(2.0, { ratedCount: 20, knownHitCount: 0 })
    expect(up - 2.0).toBeLessThanOrEqual(COMFORT.MAX_STEP + 1e-9)
    expect(2.0 - down).toBeLessThanOrEqual(COMFORT.MAX_STEP + 1e-9)
  })

  it('clamps to [MIN, MAX]', () => {
    expect(updateComfort(COMFORT.MAX, { ratedCount: 10, knownHitCount: 10 })).toBeLessThanOrEqual(COMFORT.MAX)
    expect(updateComfort(COMFORT.MIN, { ratedCount: 10, knownHitCount: 0 })).toBeGreaterThanOrEqual(COMFORT.MIN)
  })

  it('a repeated strong session converges toward TARGET+ territory without overshooting wildly', () => {
    let comfort = 1.0
    for (let i = 0; i < 20; i++) {
      comfort = updateComfort(comfort, { ratedCount: 10, knownHitCount: 10 })
    }
    expect(comfort).toBeGreaterThan(2.5)
    expect(comfort).toBeLessThanOrEqual(COMFORT.MAX)
  })
})

describe('strongStreakNext', () => {
  it('is unaffected by a too-short session', () => {
    expect(strongStreakNext(3, { ratedCount: 1, knownHitCount: 1 })).toBe(3)
  })

  it('increments on a strong ratio', () => {
    expect(strongStreakNext(2, { ratedCount: 10, knownHitCount: 9 })).toBe(3)
  })

  it('resets to 0 on a rated-but-weak session', () => {
    expect(strongStreakNext(2, { ratedCount: 10, knownHitCount: 5 })).toBe(0)
  })
})

describe('shouldPromptLevelUp', () => {
  // `enabled` is passed explicitly throughout: these cover the RULE, which
  // outlives the LEVEL_UP_PROMPT_ENABLED switch currently holding the prompt
  // off. Flipping that switch must not require editing a single case here.
  const base = {
    comfortLevel: 3.2,
    strongStreak: COMFORT.STRONG_STREAK_FOR_PROMPT,
    todayLevel: 2,
    levelUpPrompt: { dismissedForLevel: null, lastShownAt: null },
    masteredPacksAtFloor: COMFORT.MASTERED_PACKS_FOR_PROMPT,
    enabled: true,
  }

  it('fires exactly when the streak, comfort gap, and mastery bar are all met', () => {
    expect(shouldPromptLevelUp(base)).toEqual({ target: 3 })
  })

  it('never fires while the switch is off, however far past every bar the learner is', () => {
    expect(shouldPromptLevelUp({ ...base, enabled: false })).toBeNull()
    expect(shouldPromptLevelUp({
      ...base, enabled: false, comfortLevel: COMFORT.MAX, strongStreak: 99, masteredPacksAtFloor: 99,
    })).toBeNull()
  })

  it('does not fire below the strong-streak threshold', () => {
    expect(shouldPromptLevelUp({ ...base, strongStreak: COMFORT.STRONG_STREAK_FOR_PROMPT - 1 })).toBeNull()
  })

  it('does not fire when comfort has not cleared a full level above the floor', () => {
    expect(shouldPromptLevelUp({ ...base, comfortLevel: base.todayLevel + 0.5 })).toBeNull()
  })

  it('does not fire without enough mastered packs at the current floor', () => {
    expect(shouldPromptLevelUp({ ...base, masteredPacksAtFloor: COMFORT.MASTERED_PACKS_FOR_PROMPT - 1 })).toBeNull()
  })

  it('respects a dismissal for the same target until the cooldown passes', () => {
    const justDismissed = {
      ...base,
      levelUpPrompt: { dismissedForLevel: 3, lastShownAt: '2026-06-01' },
    }
    expect(shouldPromptLevelUp({ ...justDismissed, now: new Date('2026-06-05') })).toBeNull()
    expect(
      shouldPromptLevelUp({
        ...justDismissed,
        now: new Date('2026-06-01T00:00:00Z'),
      })
    ).toBeNull()
    const afterCooldown = shouldPromptLevelUp({
      ...justDismissed,
      now: new Date('2026-06-20'),
    })
    expect(afterCooldown).toEqual({ target: 3 })
  })

  it('a dismissal for a different (lower) target does not block a fresh higher target', () => {
    expect(shouldPromptLevelUp({ ...base, levelUpPrompt: { dismissedForLevel: 2, lastShownAt: '2026-06-01' } }))
      .toEqual({ target: 3 })
  })
})

describe('comfortFit', () => {
  // Every boundary below is a real engine threshold, not a UI choice — the
  // point of these tests is that they stay tied to COMFORT, so moving a
  // constant moves the wording with it instead of quietly desynchronising.
  it('calls it matched inside one session of movement either way', () => {
    expect(comfortFit(2, 2)).toBe('matched')
    expect(comfortFit(2 + COMFORT.MAX_STEP - 0.01, 2)).toBe('matched')
    expect(comfortFit(2 - COMFORT.MAX_STEP + 0.01, 2)).toBe('matched')
  })

  it('calls it demanding once comfort trails the level by more than a step', () => {
    expect(comfortFit(2 - COMFORT.MAX_STEP - 0.01, 2)).toBe('demanding')
    expect(comfortFit(1, 4)).toBe('demanding')
  })

  it('separates "easy" from "stretching" exactly at STRETCH_MARGIN', () => {
    expect(comfortFit(2 + COMFORT.STRETCH_MARGIN - 0.01, 2)).toBe('easy')
    // selectSmart starts weaving in harder words at precisely this point.
    expect(comfortFit(2 + COMFORT.STRETCH_MARGIN, 2)).toBe('stretching')
  })

  it('calls it ready at a full level ahead — shouldPromptLevelUp\'s own floor', () => {
    expect(comfortFit(2.99, 2)).toBe('stretching')
    expect(comfortFit(3, 2)).toBe('ready')
    expect(comfortFit(4.9, 1)).toBe('ready')
  })

  it('never falls outside the ordered scale', () => {
    for (const level of [1, 2, 3, 4]) {
      for (let c = COMFORT.MIN; c <= COMFORT.MAX; c += 0.1) {
        expect(COMFORT_FIT_ORDER).toContain(comfortFit(c, level))
      }
    }
  })
})
