import { describe, it, expect } from 'vitest'
import {
  activeDayMinutes,
  computeReviewBudget,
  computeServingState,
  maintenanceLoad,
  reviewMinutes,
  reviewSecPerCard,
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
import {
  SERVING_MIN, PACE_FLOOR, DEBT_HORIZON_DAYS, REVIEWS_PER_MINUTE,
  REVIEW_SEC_PER_CARD, REVIEW_PACE,
} from './reviewConfig'
import type { DailyTime, Session, WordProgress } from '../types/progress'

const TODAY = '2026-06-01'
const ctx: PriorityCtx = { today: TODAY, todayLevel: null, packLevelOf: () => 1 }

function due(overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    wordId: 'w', packageId: 'p', seenCount: 1, lastSeen: '2026-05-20T12:00:00Z',
    status: 'known', reviewCount: 2, nextReviewAt: '2026-05-30', // 2 days late
    ...overrides,
  } as WordProgress
}

describe('activeDayMinutes', () => {
  const day = (date: string, secondsStudied: number): DailyTime =>
    ({ date, secondsStudied, goalSec: 3600, goalMetAt: null })

  it('averages over study days, not calendar days', () => {
    // Two 20-minute days in a week is a 20-minute learner who studies twice a
    // week — not a 5-minute learner. The old 7-day pace divided by 7 and read
    // the same history as "barely studies at all".
    const ledger = [day('2026-05-30', 1200), day('2026-06-01', 1200)]
    expect(activeDayMinutes(ledger, TODAY)).toBe(20)
  })

  it('ignores days too short to be study, and anything outside the window', () => {
    const ledger = [
      day('2026-06-01', 1200), // counts
      day('2026-05-31', 30), // app opened and closed — not a study day
      day('2026-01-01', 6000), // long before the window
    ]
    expect(activeDayMinutes(ledger, TODAY)).toBe(20)
  })

  it('returns null — not zero — when there is no qualifying day at all', () => {
    expect(activeDayMinutes([], TODAY)).toBeNull()
    expect(activeDayMinutes([day('2026-06-01', 10)], TODAY)).toBeNull()
  })

  it('falls back to older study days for a learner returning after a break', () => {
    // Null means "no history", which the budget reads as "trust the stated
    // goal" and hands over all of it. Someone back after three weeks away has
    // history — and meeting them with the biggest serving the app can build is
    // the starvation bug pointed the other way.
    const lapsed = [day('2026-05-01', 720), day('2026-05-02', 720)] // 12-min sittings, long ago
    expect(activeDayMinutes(lapsed, TODAY)).toBe(12)
    expect(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: activeDayMinutes(lapsed, TODAY), backlog: 316 }))
      .toBeLessThan(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: null, backlog: 316 }))
  })

  it('prefers the window over the fallback when the window has anything at all', () => {
    const mixed = [day('2026-05-01', 3600), day('2026-06-01', 600)] // 60 min long ago, 10 min now
    expect(activeDayMinutes(mixed, TODAY)).toBe(10)
  })
})

/** Cards a given number of minutes buys at the cold-start pace — the budget's
 *  own unit. Written out rather than hardcoded so re-tuning the pace re-tunes
 *  the expectations with it, instead of failing eight tests. */
const cards = (minutes: number) => Math.round(minutes * REVIEWS_PER_MINUTE)

describe('computeReviewBudget', () => {
  it('caps at the goal-derived value; measured study time is the reality check', () => {
    // goal 15 min → goalDerived 90. Sits for 40 min → timeDerived 240. min = 90.
    expect(computeReviewBudget({ goalSec: 15 * 60, activeMinutes: 40 })).toBe(cards(15))
    // Short sittings pull the budget below the goal ceiling: a 60-minute goal
    // with 10-minute sittings gets 10 minutes' worth.
    expect(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 10 })).toBe(cards(10))
  })

  it("sizes the day in the learner's own seconds per card", () => {
    // The whole point of threading the pace through: the same goal and the same
    // sittings buy more cards for someone who answers faster. At 50 s a card —
    // the figure the app used to assume for everyone — a 20-minute goal was 24
    // reviews, done in four real minutes.
    const brisk = computeReviewBudget({ goalSec: 20 * 60, activeMinutes: 20, secPerCard: 6 })
    const slow = computeReviewBudget({ goalSec: 20 * 60, activeMinutes: 20, secPerCard: 24 })
    expect(brisk).toBe(200)
    expect(slow).toBe(50)
  })

  it('never drops below the floor, never promises more than the goal holds', () => {
    expect(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 0 })).toBe(Math.max(SERVING_MIN, PACE_FLOOR))
    // The goal is the ceiling however long they sit or how far behind they are.
    expect(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 600, backlog: 10_000 })).toBe(cards(60))
  })

  it('trusts the stated goal when there is no history to check it against', () => {
    // Measured zero is evidence about a learner; a MISSING measurement is a
    // brand-new account, where the only signal there is happens to be the goal
    // they just chose. Conflating the two let day one on a 60-minute goal serve
    // eight words and call the day's portion done.
    const noHistory = computeReviewBudget({ goalSec: 60 * 60, activeMinutes: null })
    expect(noHistory).toBe(cards(60))
    expect(noHistory).toBeGreaterThan(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 0 }))
    // A small goal is still respected — this trusts the goal, it doesn't ignore it.
    expect(computeReviewBudget({ goalSec: 10 * 60, activeMinutes: null })).toBe(cards(10))
  })

  it('lets the backlog raise the floor, spread over DEBT_HORIZON_DAYS', () => {
    // A 60-minute goal, 2-minute sittings, 316 words due. Time alone says 12;
    // the arrears say ceil(316/14) = 23. (The reported case was stated in
    // 10-minute sittings, which at an honest pace now covers the arrears on
    // their own — which is the fix working, not the floor going away.)
    const behind = computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 2, backlog: 316 })
    expect(behind).toBe(Math.ceil(316 / DEBT_HORIZON_DAYS))
    expect(behind).toBeGreaterThan(computeReviewBudget({ goalSec: 60 * 60, activeMinutes: 2, backlog: 0 }))
  })

  it('never lets the debt floor overrun the goal ceiling', () => {
    // A small goal with a huge backlog still gets a small-goal serving: the
    // point of the floor is to stop under-serving, not to overrule the goal.
    expect(computeReviewBudget({ goalSec: 10 * 60, activeMinutes: 10, backlog: 10_000 })).toBe(cards(10))
  })

  it('does not measure itself — a capped serving cannot ratchet the budget down', () => {
    // The old model read `wordsCompleted`, which on a review session IS the
    // budget it granted. Simulated over 60 days, a learner clearing the serving
    // on 3 days a week stayed pinned to the floor forever. The budget now reads
    // study time, so the same learner is judged on the length of their sittings.
    const ledger: DailyTime[] = []
    let budget = SERVING_MIN
    for (let i = 0; i < 60; i++) {
      const date = `2026-04-${String((i % 28) + 1).padStart(2, '0')}`
      const studies = i % 7 < 3 // three days a week
      if (studies) ledger.push({ date, secondsStudied: 25 * 60, goalSec: 3600, goalMetAt: null })
      budget = computeReviewBudget({
        goalSec: 60 * 60,
        activeMinutes: activeDayMinutes(ledger, date),
        backlog: 0,
      })
    }
    expect(budget).toBe(cards(25)) // 25-minute sittings, honestly read
    expect(budget).toBeGreaterThan(SERVING_MIN)
  })
})

describe('reviewMinutes', () => {
  it('reads the count at the pace the budget was sized with', () => {
    expect(reviewMinutes(30)).toBe(Math.round(30 / REVIEWS_PER_MINUTE))
    expect(reviewMinutes(0)).toBe(1) // never "0 min"
  })

  it('takes the measured pace, so the label cannot outrun the cards', () => {
    // The reported case: 88 due words announced as "ok. 73 min" — the 50 s/card
    // assumption — for a queue its owner clears at about eight seconds a card.
    expect(reviewMinutes(88, 50)).toBe(73)
    expect(reviewMinutes(88, 8)).toBe(12)
  })
})

describe('reviewSecPerCard', () => {
  const session = (over: Partial<Session> = {}): Session => ({
    packageId: '__review__', date: TODAY, wordsCompleted: 20, mode: 'fiszki',
    trainMode: 'review', durationSec: 160, ...over,
  })

  it('falls back to the default until there is enough review history', () => {
    expect(reviewSecPerCard([], TODAY)).toBe(REVIEW_SEC_PER_CARD)
    // One 20-card sitting is real evidence but not yet enough of it.
    expect(reviewSecPerCard([session()], TODAY)).toBe(REVIEW_SEC_PER_CARD)
  })

  it('measures the learner once they have a history', () => {
    // Two 20-card sittings at 8 s a card.
    expect(reviewSecPerCard([session(), session()], TODAY)).toBe(8)
  })

  it('ignores sessions that are not reviews, and ones too old to mean anything', () => {
    // Trenuj and Inteligentny cards are a different job at a different speed.
    const others = [
      session({ trainMode: 'word-flash', durationSec: 600 }),
      session({ trainMode: 'word-flash', durationSec: 600 }),
    ]
    expect(reviewSecPerCard(others, TODAY)).toBe(REVIEW_SEC_PER_CARD)
    const stale = [session({ date: '2025-01-01' }), session({ date: '2025-01-02' })]
    expect(reviewSecPerCard(stale, TODAY)).toBe(REVIEW_SEC_PER_CARD)
  })

  it('bounds a clock artefact out of the pace', () => {
    // A tab left open behind a finished session is not a 40-minute card.
    const abandoned = [session({ durationSec: 4000 }), session({ durationSec: 4000 })]
    expect(reviewSecPerCard(abandoned, TODAY)).toBe(REVIEW_PACE.MAX_SEC)
    const impossible = [session({ durationSec: 20 }), session({ durationSec: 20 })]
    expect(reviewSecPerCard(impossible, TODAY)).toBe(REVIEW_PACE.MIN_SEC)
  })
})

describe('maintenanceLoad', () => {
  it('sums 1/stability over live known words', () => {
    const load = maintenanceLoad([
      due({ wordId: 'a', status: 'known', stability: 2 }), // 0.5/day
      due({ wordId: 'b', status: 'known', stability: 4 }), // 0.25/day
      due({ wordId: 'c', status: 'known', stability: 4 }), // 0.25/day
    ], 1)
    expect(load.perDay).toBe(1)
    // A load this small is under a minute, but "~0 min to keep this up" reads
    // as a broken number rather than a light one — hence reviewMinutes' floor.
    expect(load.minutesPerDay).toBe(1)
    expect(maintenanceLoad([], 1).minutesPerDay).toBe(0) // …and no load is no minutes
    // The daily upkeep is quoted at the learner's own pace, like every other
    // minutes figure on the card it's printed on.
    const six = Array.from({ length: 6 }, (_, i) =>
      due({ wordId: `s${i}`, status: 'known', stability: 1 }))
    expect(maintenanceLoad(six, 1, 10).minutesPerDay).toBe(1)
    expect(maintenanceLoad(six, 1, 60).minutesPerDay).toBe(6)
    expect(load.coveredPct).toBe(100)
  })

  it('excludes retired and not-yet-known words, and reports the shortfall', () => {
    const load = maintenanceLoad([
      due({ wordId: 'a', status: 'known', stability: 1 }), // 1/day
      due({ wordId: 'b', status: 'known', stability: 1, retiredAt: '2026-01-01' }), // deep maintenance
      due({ wordId: 'c', status: 'learning', stability: 1 }), // not known yet
    ], 1)
    expect(load.perDay).toBe(1)
    // A budget covering half the inflow is a queue that grows whatever the
    // budget is tuned to — the number Etap 3 exists to act on.
    expect(maintenanceLoad([
      due({ wordId: 'a', status: 'known', stability: 1 }),
      due({ wordId: 'b', status: 'known', stability: 1 }),
    ], 1).coveredPct).toBe(50)
  })
})

describe('computeServingState', () => {
  const words = [due()]
  it('remaining is min(backlog, budget - served)', () => {
    const s = computeServingState({
      due: words, wordProgress: words, goalSec: 15 * 60, activeMinutes: 30, today: TODAY,
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
