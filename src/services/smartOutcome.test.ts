import { describe, it, expect } from 'vitest'
import { record, summarize, CardOutcome, HORIZON_BUCKETS } from './smartOutcome'
import { WordProgress } from '../types/progress'

const TODAY = '2026-09-20'

const wp = (o: Partial<WordProgress> = {}): WordProgress => ({
  wordId: 'w1',
  packageId: 'p1',
  seenCount: 1,
  lastSeen: `${TODAY}T08:00:00.000Z`,
  status: 'new',
  ...o,
})

const out = (o: Partial<CardOutcome> = {}): CardOutcome => ({
  segment: 'review',
  transition: 'held',
  intervalBefore: 4,
  intervalAfter: 11,
  ...o,
})

describe('record', () => {
  it('names the crossing, not the verdict', () => {
    const entered = record({
      segment: 'learn',
      before: undefined,
      after: wp({ status: 'known', nextReviewAt: '2026-09-23' }),
      recalled: true,
      today: TODAY,
    })
    expect(entered.transition).toBe('entered')

    // A new word that didn't stick is ordinary, not a failure — its own outcome.
    const met = record({
      segment: 'learn',
      before: wp({ status: 'learning' }),
      after: wp({ status: 'learning', nextReviewAt: '2026-09-21' }),
      recalled: false,
      today: TODAY,
    })
    expect(met.transition).toBe('met')

    const known = wp({ status: 'known', lastSeen: '2026-09-16T08:00:00.000Z', nextReviewAt: '2026-09-20' })
    expect(record({ segment: 'review', before: known, after: wp({ status: 'known', nextReviewAt: '2026-10-01' }), recalled: true, today: TODAY }).transition)
      .toBe('held')
    expect(record({ segment: 'review', before: known, after: wp({ status: 'known', nextReviewAt: '2026-09-21' }), recalled: false, today: TODAY }).transition)
      .toBe('slipped')
  })

  it('measures the previous interval from when the word was last answered, not from today', () => {
    // Scheduled on the 16th for the 20th: a 4-day interval it had been holding.
    // Answered today, three days LATE — measuring from today would call that -3
    // and report a fact about the queue rather than about the memory.
    const o = record({
      segment: 'review',
      before: wp({ status: 'known', lastSeen: '2026-09-16T08:00:00.000Z', nextReviewAt: '2026-09-20' }),
      after: wp({ status: 'known', nextReviewAt: '2026-10-02' }),
      recalled: true,
      today: '2026-09-23',
    })
    expect(o.intervalBefore).toBe(4)
    expect(o.intervalAfter).toBe(9)
  })

  it('has no previous interval for a word met for the first time', () => {
    const o = record({
      segment: 'learn',
      before: undefined,
      after: wp({ status: 'known', nextReviewAt: '2026-09-23' }),
      recalled: true,
      today: TODAY,
    })
    expect(o.intervalBefore).toBeNull()
    expect(o.intervalAfter).toBe(3)
  })
})

describe('summarize', () => {
  it('buckets by when the word comes back', () => {
    const s = summarize([
      out({ intervalAfter: 1 }), out({ intervalAfter: 2 }),
      out({ intervalAfter: 5 }),
      out({ intervalAfter: 21 }),
      out({ intervalAfter: 400 }),
    ])
    expect(s.horizon).toEqual([2, 1, 1, 0, 1])
    expect(s.horizon).toHaveLength(HORIZON_BUCKETS.length)
  })

  it('compares the same words to themselves', () => {
    const s = summarize([
      out({ intervalBefore: 3, intervalAfter: 9 }),
      out({ intervalBefore: 4, intervalAfter: 11 }),
      out({ intervalBefore: 5, intervalAfter: 14 }),
      // No previous schedule: contributes to the strip but to neither median.
      out({ intervalBefore: null, intervalAfter: 1 }),
    ])
    expect(s.shift).toEqual({ before: 4, after: 11 })
  })

  it('uses a median so one graduating word cannot invent a horizon', () => {
    const s = summarize([
      out({ intervalBefore: 3, intervalAfter: 8 }),
      out({ intervalBefore: 4, intervalAfter: 9 }),
      out({ intervalBefore: 5, intervalAfter: 10 }),
      out({ intervalBefore: 6, intervalAfter: 400 }),
    ])
    // A mean would claim these words come back in three and a half months.
    expect(s.shift!.after).toBe(10)
  })

  it('says nothing when there is too little to compare, or nothing moved', () => {
    expect(summarize([out(), out()]).shift).toBeNull()
    expect(summarize([
      out({ intervalBefore: 8, intervalAfter: 8 }),
      out({ intervalBefore: 8, intervalAfter: 8 }),
      out({ intervalBefore: 8, intervalAfter: 8 }),
    ]).shift).toBeNull()
  })

  it('hides the strip when every word lands in one bucket', () => {
    // A sitting of nothing but first-time words: all scheduled alike, so the
    // "distribution" is one bar.
    const allNew = Array.from({ length: 10 }, () =>
      out({ transition: 'entered', intervalBefore: null, intervalAfter: 2 })
    )
    expect(summarize(allNew).showHorizon).toBe(false)

    const spread = [...allNew.slice(0, 8), out({ intervalAfter: 30 })]
    expect(summarize(spread).showHorizon).toBe(true)
  })

  it('hides the strip when too few words are scheduled at all', () => {
    const s = summarize([out({ intervalAfter: 1 }), out({ intervalAfter: 30 })])
    expect(s.showHorizon).toBe(false)
  })

  it('counts every answered card, scheduled or not', () => {
    const s = summarize([
      out({ transition: 'entered', intervalAfter: 3 }),
      out({ transition: 'held', intervalAfter: 20 }),
      out({ transition: 'slipped', intervalAfter: 1 }),
      out({ transition: 'met', intervalAfter: null }),
    ])
    expect(s.total).toBe(4)
    expect(s.transitions).toEqual({ entered: 1, held: 1, slipped: 1, met: 1 })
  })
})
