import { describe, it, expect } from 'vitest'
import {
  retrievability,
  nextInterval,
  initCard,
  review,
  seedFromLadder,
  applyFuzz,
  AGAIN,
  GOOD,
} from './fsrs'
import { REVIEW_LADDER, REQUEST_RETENTION } from './reviewConfig'

describe('retrievability', () => {
  it('is 1 at t=0 and decreases with elapsed time', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 5)
    const a = retrievability(5, 10)
    const b = retrievability(20, 10)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(0)
    expect(a).toBeLessThan(1)
  })

  it('equals the request retention when t === stability', () => {
    expect(retrievability(10, 10)).toBeCloseTo(REQUEST_RETENTION, 4)
    expect(retrievability(37, 37)).toBeCloseTo(REQUEST_RETENTION, 4)
  })
})

describe('nextInterval', () => {
  it('≈ stability at request retention 0.9', () => {
    expect(nextInterval(20)).toBe(20)
    expect(nextInterval(100)).toBe(100)
  })
  it('clamps into [1, 730]', () => {
    expect(nextInterval(0.2)).toBe(1)
    expect(nextInterval(99999)).toBe(730)
  })
})

describe('initCard', () => {
  it('GOOD seeds a larger stability and easier difficulty than AGAIN', () => {
    const g = initCard(GOOD)
    const a = initCard(AGAIN)
    expect(g.stability).toBeGreaterThan(a.stability)
    expect(g.difficulty).toBeLessThan(a.difficulty)
    expect(g.difficulty).toBeGreaterThanOrEqual(1)
    expect(g.difficulty).toBeLessThanOrEqual(10)
    expect(g.intervalDays).toBeGreaterThanOrEqual(1)
  })
})

describe('review', () => {
  const card = { stability: 10, difficulty: 5 }

  it('GOOD grows stability, AGAIN shrinks it (and never above the prior)', () => {
    const good = review(card, GOOD, 10)
    expect(good.stability).toBeGreaterThan(card.stability)

    const again = review(card, AGAIN, 10)
    expect(again.stability).toBeLessThanOrEqual(card.stability)
    expect(again.stability).toBeGreaterThan(0)
  })

  it('a longer gap before a successful review yields more stability gain', () => {
    const soon = review(card, GOOD, 3)
    const late = review(card, GOOD, 25)
    expect(late.stability).toBeGreaterThan(soon.stability)
  })

  it('difficulty stays within [1, 10] and rises on a lapse', () => {
    const again = review(card, AGAIN, 10)
    expect(again.difficulty).toBeGreaterThan(card.difficulty)
    expect(again.difficulty).toBeLessThanOrEqual(10)
    const good = review({ stability: 10, difficulty: 9.5 }, GOOD, 10)
    expect(good.difficulty).toBeLessThanOrEqual(10)
    expect(good.difficulty).toBeGreaterThanOrEqual(1)
  })

  it('same-day review (elapsed 0) does not blow up', () => {
    const r = review(card, GOOD, 0)
    expect(Number.isFinite(r.stability)).toBe(true)
    expect(r.stability).toBeGreaterThan(0)
  })
})

describe('seedFromLadder', () => {
  it('maps the rung to a stability equal to that ladder interval', () => {
    expect(seedFromLadder(REVIEW_LADDER, 0, 0).stability).toBe(REVIEW_LADDER[0])
    expect(seedFromLadder(REVIEW_LADDER, 3, 0).stability).toBe(REVIEW_LADDER[3])
    expect(seedFromLadder(REVIEW_LADDER, 99, 0).stability).toBe(REVIEW_LADDER[REVIEW_LADDER.length - 1])
  })
  it('raises difficulty with past lapses, clamped to 10', () => {
    expect(seedFromLadder(REVIEW_LADDER, 2, 0).difficulty).toBeCloseTo(5.3, 5)
    expect(seedFromLadder(REVIEW_LADDER, 2, 3).difficulty).toBeCloseTo(7.7, 5)
    expect(seedFromLadder(REVIEW_LADDER, 2, 20).difficulty).toBe(10)
  })
})

describe('applyFuzz', () => {
  it('leaves 1-day intervals alone', () => {
    expect(applyFuzz(1, () => 0.5)).toBe(1)
  })
  it('stays within ± ~8% and never below 1', () => {
    for (let i = 0; i < 200; i++) {
      const out = applyFuzz(100)
      expect(out).toBeGreaterThanOrEqual(92)
      expect(out).toBeLessThanOrEqual(108)
    }
    expect(applyFuzz(2, () => 0)).toBeGreaterThanOrEqual(1)
  })
})
