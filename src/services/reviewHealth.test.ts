import { describe, it, expect } from 'vitest'
import {
  HEALTH,
  EMPTY_REVIEW_HEALTH,
  ReviewHealth,
  updateReviewHealth,
  healthValue,
  reviewRatioFor,
  requestRetentionFor,
  allowStretch,
  healthTone,
} from './reviewHealth'
import { REQUEST_RETENTION } from './reviewConfig'
import { nextInterval } from './fsrs'

const BASE = 0.35
const TODAY = new Date('2026-09-11T10:00:00Z')

/** A health state parked at `value` with enough samples for the loops to act. */
function ready(value: number, updatedAt = '2026-09-11'): ReviewHealth {
  return { value, samples: HEALTH.MIN_SAMPLES, updatedAt }
}

describe('updateReviewHealth', () => {
  it('drops a batch too small to mean anything', () => {
    const after = updateReviewHealth(EMPTY_REVIEW_HEALTH, { rated: HEALTH.MIN_BATCH - 1, known: 0 }, TODAY)
    expect(after).toEqual(EMPTY_REVIEW_HEALTH)
  })

  it('seeds from the first real batch, then moves as an EWMA', () => {
    const first = updateReviewHealth(EMPTY_REVIEW_HEALTH, { rated: 10, known: 8 }, TODAY)
    expect(first.value).toBeCloseTo(0.8, 5)
    expect(first.samples).toBe(10)

    // A perfect batch pulls up, but only by its weight (GAIN at FULL_BATCH).
    const second = updateReviewHealth(first, { rated: 10, known: 10 }, TODAY)
    expect(second.value).toBeCloseTo(0.8 + 0.2 * HEALTH.GAIN, 5)
    expect(second.samples).toBe(20)
  })

  it('weights a short batch less than a full one', () => {
    const start = ready(0.8)
    const short = updateReviewHealth(start, { rated: 5, known: 5 }, TODAY)
    const full = updateReviewHealth(start, { rated: 10, known: 10 }, TODAY)
    expect(short.value! - 0.8).toBeLessThan(full.value! - 0.8)
  })

  it('records the day so the signal can go stale', () => {
    expect(updateReviewHealth(EMPTY_REVIEW_HEALTH, { rated: 8, known: 7 }, TODAY).updatedAt)
      .toBe('2026-09-11')
  })
})

describe('healthValue', () => {
  it('is null before there is enough evidence', () => {
    expect(healthValue(EMPTY_REVIEW_HEALTH, TODAY)).toBeNull()
    expect(healthValue({ value: 0.5, samples: HEALTH.MIN_SAMPLES - 1, updatedAt: '2026-09-11' }, TODAY))
      .toBeNull()
  })

  it('is null once the last review is older than STALE_DAYS', () => {
    expect(healthValue(ready(0.7, '2026-09-01'), TODAY)).toBe(0.7)
    expect(healthValue(ready(0.7, '2026-06-01'), TODAY)).toBeNull()
  })
})

describe('reviewRatioFor', () => {
  const at = (v: number, urgent = false) =>
    reviewRatioFor(ready(v), { base: BASE, urgent, now: TODAY })

  it('leaves the baseline alone without evidence', () => {
    expect(reviewRatioFor(EMPTY_REVIEW_HEALTH, { base: BASE, now: TODAY })).toBe(BASE)
  })

  it('leaves the baseline alone inside the dead zone', () => {
    expect(at(HEALTH.TARGET)).toBe(BASE)
    expect(at(HEALTH.TARGET + HEALTH.DEAD_ZONE)).toBe(BASE)
    expect(at(HEALTH.TARGET - HEALTH.DEAD_ZONE)).toBe(BASE)
  })

  it('buys new words when review is going well, and maintenance when it is not', () => {
    expect(at(0.95)).toBeLessThan(BASE)
    expect(at(0.75)).toBeGreaterThan(BASE)
  })

  it('stays inside its bounds at both extremes', () => {
    expect(at(1)).toBe(HEALTH.RATIO_MIN)
    expect(at(0)).toBe(HEALTH.RATIO_MAX)
  })

  it('does not let a good streak shrink the slice while the backlog is urgent', () => {
    expect(at(0.98, true)).toBe(BASE)
    // …but a bad one still raises it — the override is a floor, not a freeze.
    expect(at(0.7, true)).toBeGreaterThan(BASE)
  })
})

describe('allowStretch', () => {
  it('allows stretch without evidence and while health holds', () => {
    expect(allowStretch(EMPTY_REVIEW_HEALTH, TODAY)).toBe(true)
    expect(allowStretch(ready(HEALTH.STRETCH_FLOOR), TODAY)).toBe(true)
  })

  it('vetoes stretch once retention slips below the floor', () => {
    expect(allowStretch(ready(HEALTH.STRETCH_FLOOR - 0.01), TODAY)).toBe(false)
  })
})

describe('requestRetentionFor', () => {
  const at = (v: number) => requestRetentionFor(ready(v), TODAY)

  it('is the population default without evidence or inside the dead zone', () => {
    expect(requestRetentionFor(EMPTY_REVIEW_HEALTH, TODAY)).toBe(REQUEST_RETENTION)
    expect(at(HEALTH.TARGET)).toBe(REQUEST_RETENTION)
  })

  it('stays inside its bounds at both extremes', () => {
    expect(at(1)).toBe(HEALTH.RR_MIN)
    expect(at(0)).toBe(HEALTH.RR_MAX)
  })

  it('stretches intervals for a strong learner and shortens them for a slipping one', () => {
    const s = 30
    expect(nextInterval(s, at(0.95))).toBeGreaterThan(nextInterval(s, REQUEST_RETENTION))
    expect(nextInterval(s, at(0.75))).toBeLessThan(nextInterval(s, REQUEST_RETENTION))
  })

  it('keeps even the extremes to a sane multiple of the default interval', () => {
    const s = 30
    const base = nextInterval(s, REQUEST_RETENTION)
    expect(nextInterval(s, at(1))).toBeLessThanOrEqual(base * 1.6)
    expect(nextInterval(s, at(0))).toBeGreaterThanOrEqual(base * 0.4)
  })
})

describe('healthTone', () => {
  it('reads null / strong / steady / slipping', () => {
    expect(healthTone(EMPTY_REVIEW_HEALTH, TODAY)).toBeNull()
    expect(healthTone(ready(0.95), TODAY)).toBe('strong')
    expect(healthTone(ready(HEALTH.TARGET), TODAY)).toBe('steady')
    expect(healthTone(ready(0.7), TODAY)).toBe('slipping')
  })
})
