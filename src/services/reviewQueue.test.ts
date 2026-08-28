import { describe, it, expect } from 'vitest'
import {
  computeReviewBudget,
  computeServingState,
  reviewsDoneToday,
  scoreDueWord,
  orderDueWords,
  reviewUrgency,
  staleWordCount,
  retrievabilityOf,
  effectiveStability,
  retentionTierOf,
  retentionBreakdown,
  PriorityCtx,
} from './reviewQueue'
import { SERVING_MIN, SERVING_MAX, PACE_FLOOR } from './reviewConfig'
import type { WordProgress } from '../types/progress'

const TODAY = '2026-06-01'
const ctx: PriorityCtx = { today: TODAY, todayLevel: null, packLevelOf: () => 1 }

function due(overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    wordId: 'w', packageId: 'p', seenCount: 1, lastSeen: '2026-05-20T12:00:00Z',
    status: 'known', reviewCount: 2, nextReviewAt: '2026-05-30', // 2 days late
    ...overrides,
  } as WordProgress
}

describe('computeReviewBudget (pace mode)', () => {
  it('caps at the goal-derived value; the recent pace is the reality check', () => {
    // goal 15 min → goalDerived 18. Pace 40/day → paceDerived 60. min(18, 60) = 18.
    expect(computeReviewBudget({ goalSec: 15 * 60, recentPace: 40 })).toBe(18)
    // Low pace pulls the budget below the goal ceiling: goalDerived 72, pace 4 →
    // paceDerived 6 → min(72, max(6, PACE_FLOOR)) → clamped up to SERVING_MIN.
    expect(computeReviewBudget({ goalSec: 60 * 60, recentPace: 4 })).toBe(Math.max(SERVING_MIN, PACE_FLOOR))
  })

  it('never drops below SERVING_MIN, never above SERVING_MAX', () => {
    expect(computeReviewBudget({ goalSec: 60 * 60, recentPace: 0 })).toBe(Math.max(SERVING_MIN, PACE_FLOOR))
    expect(computeReviewBudget({ goalSec: 60 * 60, recentPace: 1000 })).toBe(SERVING_MAX)
  })
})

describe('computeServingState', () => {
  const words = [due()]
  it('remaining is min(backlog, budget - served)', () => {
    const s = computeServingState({
      due: words, wordProgress: words, goalSec: 15 * 60, recentPace: 30, today: TODAY,
    })
    expect(s.backlog).toBe(1)
    expect(s.remaining).toBe(1) // only 1 due, plenty of budget
    expect(s.done).toBe(false)
  })
})

describe('reviewsDoneToday', () => {
  it('counts words reviewed today that were rescheduled forward, excludes first-learns', () => {
    const list: WordProgress[] = [
      // reviewed today, rescheduled → counts
      due({ lastSeen: `${TODAY}T09:00:00Z`, reviewCount: 3, nextReviewAt: '2026-06-20' }),
      // learned today for the first time (no reps/lapses) → does not count
      due({ lastSeen: `${TODAY}T09:00:00Z`, reviewCount: 0, lapseCount: 0, nextReviewAt: '2026-06-04' }),
      // reviewed yesterday → does not count
      due({ lastSeen: '2026-05-31T09:00:00Z', reviewCount: 3, nextReviewAt: '2026-06-20' }),
      // answered today but still due (not rescheduled forward) → does not count
      due({ lastSeen: `${TODAY}T09:00:00Z`, reviewCount: 2, nextReviewAt: '2026-05-30' }),
    ]
    expect(reviewsDoneToday(list, TODAY)).toBe(1)
  })
})

describe('scoreDueWord — anti-starvation', () => {
  it('a critically-decayed word beats a fresh below-level word', () => {
    const levelCtx: PriorityCtx = { today: TODAY, todayLevel: 3, packLevelOf: () => 1 }
    const critical = due({ stability: 3, lastSeen: '2026-04-20T12:00:00Z' }) // R well below 0.65
    const belowFresh = due({ stability: 50, lastSeen: '2026-05-30T12:00:00Z' })
    expect(scoreDueWord(critical, levelCtx)).toBeGreaterThan(scoreDueWord(belowFresh, levelCtx))
  })

  it('a word overdue past the grace window outranks a barely-late one', () => {
    const neglected = due({ nextReviewAt: '2026-05-01', stability: undefined }) // 31 days late, no FSRS
    const barely = due({ nextReviewAt: '2026-05-30', stability: undefined })
    expect(scoreDueWord(neglected, ctx)).toBeGreaterThan(scoreDueWord(barely, ctx))
  })

  it('orderDueWords puts the most urgent first', () => {
    const a = due({ wordId: 'a', stability: 3, lastSeen: '2026-04-15T12:00:00Z' })
    const b = due({ wordId: 'b', stability: 80, lastSeen: '2026-05-29T12:00:00Z' })
    expect(orderDueWords([b, a], ctx)[0].wordId).toBe('a')
  })
})

describe('reviewUrgency', () => {
  const state = { backlog: 5, budget: 20, served: 0, remaining: 5, done: false }
  it('is urgent when any word is about to be forgotten', () => {
    const list = [due({ stability: 2, lastSeen: '2026-04-01T12:00:00Z' })]
    expect(reviewUrgency({ state, due: list, today: TODAY })).toBe('urgent')
  })
  it('is calm when the backlog is small and nothing is decayed', () => {
    const list = [due({ stability: 60, lastSeen: `${TODAY}T00:00:00Z`, nextReviewAt: TODAY })]
    expect(reviewUrgency({ state, due: list, today: TODAY })).toBe('calm')
  })
})

describe('retrievabilityOf', () => {
  it('null without FSRS state, a number in (0,1) with it', () => {
    expect(retrievabilityOf(due({ stability: undefined }), TODAY)).toBeNull()
    const r = retrievabilityOf(due({ stability: 10, lastSeen: '2026-05-22T12:00:00Z' }), TODAY)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(1)
  })
})

describe('staleWordCount', () => {
  it('counts words overdue past the grace window and actually decayed', () => {
    const list = [
      due({ nextReviewAt: '2026-05-01', stability: 3, lastSeen: '2026-04-20T12:00:00Z' }), // late + decayed
      due({ nextReviewAt: '2026-05-01', stability: 400, lastSeen: '2026-05-25T12:00:00Z' }), // late but R high → skip
      due({ nextReviewAt: '2026-05-29', stability: 3, lastSeen: '2026-05-29T12:00:00Z' }), // decayed but not 14d late
    ]
    expect(staleWordCount(list, ctx)).toBe(1)
  })
})

describe('retention breakdown', () => {
  it('effectiveStability falls back to the ladder interval for pre-FSRS words', () => {
    expect(effectiveStability(due({ stability: 42 }))).toBe(42)
    expect(effectiveStability(due({ stability: undefined, reviewCount: 0 }))).toBe(3)
    expect(effectiveStability(due({ stability: undefined, reviewCount: 2 }))).toBe(20)
    // reviewCount past the ladder end clamps to the last rung
    expect(effectiveStability(due({ stability: undefined, reviewCount: 99 }))).toBe(240)
  })

  it('retentionTierOf bins by stability, and retired words are always locked', () => {
    expect(retentionTierOf(due({ stability: 3 }))).toBe('fresh')
    expect(retentionTierOf(due({ stability: 14 }))).toBe('setting')
    expect(retentionTierOf(due({ stability: 40 }))).toBe('solid')
    expect(retentionTierOf(due({ stability: 120 }))).toBe('strong')
    expect(retentionTierOf(due({ stability: 500 }))).toBe('locked')
    // retired but stability dipped — deep maintenance still reads as locked
    expect(retentionTierOf(due({ stability: 30, retiredAt: '2026-01-01T00:00:00Z' }))).toBe('locked')
  })

  it('retentionBreakdown counts only known words and reports the durable share', () => {
    const list: WordProgress[] = [
      due({ status: 'known', stability: 4 }),   // fresh
      due({ status: 'known', stability: 10 }),  // setting
      due({ status: 'known', stability: 90 }),  // strong  ─┐ durable
      due({ status: 'known', stability: 400 }), // locked  ─┘ durable
      due({ status: 'learning', stability: 2 }), // excluded
    ]
    const b = retentionBreakdown(list)
    expect(b.total).toBe(4)
    expect(b.buckets.find(x => x.tier === 'fresh')!.count).toBe(1)
    expect(b.buckets.find(x => x.tier === 'strong')!.count).toBe(1)
    expect(b.buckets.find(x => x.tier === 'locked')!.count).toBe(1)
    expect(b.durablePct).toBe(50) // 2 of 4
  })

  it('durablePct is 0 for an empty vocabulary, not NaN', () => {
    expect(retentionBreakdown([]).durablePct).toBe(0)
    expect(retentionBreakdown([]).total).toBe(0)
  })
})
