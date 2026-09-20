import { describe, it, expect } from 'vitest'
import { record, summarize, judgesDifficulty, CardOutcome, MEMORY_LEVELS } from './smartOutcome'
import { WordProgress } from '../types/progress'

const TODAY = '2026-09-21'

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
  memoryDays: 11,
  ...o,
})

describe('record', () => {
  it('names the crossing, not the verdict', () => {
    const entered = record({
      segment: 'learn',
      before: undefined,
      after: wp({ status: 'known', stability: 3 }),
      recalled: true,
      today: TODAY,
    })
    expect(entered.transition).toBe('entered')

    // A new word that didn't stick is ordinary, not a failure — its own outcome.
    const met = record({
      segment: 'learn',
      before: wp({ status: 'learning' }),
      after: wp({ status: 'learning', stability: 1 }),
      recalled: false,
      today: TODAY,
    })
    expect(met.transition).toBe('met')

    const known = wp({ status: 'known', stability: 15 })
    expect(record({ segment: 'review', before: known, after: wp({ status: 'known', stability: 104 }), recalled: true, today: TODAY }).transition)
      .toBe('held')
    expect(record({ segment: 'review', before: known, after: wp({ status: 'known', stability: 2 }), recalled: false, today: TODAY }).transition)
      .toBe('slipped')
  })

  it('reads memory strength, not the scheduled date', () => {
    // Stability and the next gap differ (~10% apart at the target retention).
    // The screen reports LEVELS, so it must read the property of the memory.
    const o = record({
      segment: 'review',
      before: wp({ status: 'known', stability: 15 }),
      after: wp({ status: 'known', stability: 104, nextReviewAt: '2026-12-28' }),
      recalled: true,
      today: TODAY,
    })
    expect(o.memoryDays).toBe(104)
  })

  it('falls back to the scheduled gap for a row with no stability', () => {
    const o = record({
      segment: 'review',
      before: wp({ status: 'known' }),
      after: wp({ status: 'known', nextReviewAt: '2026-09-30' }),
      recalled: true,
      today: TODAY,
    })
    expect(o.memoryDays).toBe(9)
  })

  it('places nothing when the word carries neither', () => {
    const o = record({
      segment: 'learn',
      before: undefined,
      after: wp({ status: 'learning' }),
      recalled: false,
      today: TODAY,
    })
    expect(o.memoryDays).toBeNull()
  })
})

describe('summarize', () => {
  it('sorts the session into memory tiers', () => {
    const s = summarize([
      out({ memoryDays: 1 }), out({ memoryDays: 2 }),
      out({ memoryDays: 5 }),
      out({ memoryDays: 21 }),
      out({ memoryDays: 400 }),
    ])
    expect(s.levels).toEqual([2, 1, 1, 0, 1])
    expect(s.levels).toHaveLength(MEMORY_LEVELS.length)
  })

  it('hides the breakdown when every word lands in one tier', () => {
    // A sitting of nothing but first-time words: all land alike, so the
    // "distribution" is a single bar.
    const allNew = Array.from({ length: 10 }, () =>
      out({ transition: 'entered', memoryDays: 2 })
    )
    expect(summarize(allNew).showLevels).toBe(false)
    expect(summarize([...allNew.slice(0, 8), out({ memoryDays: 30 })]).showLevels).toBe(true)
  })

  it('hides the breakdown when too few words could be placed', () => {
    expect(summarize([out({ memoryDays: 1 }), out({ memoryDays: 30 })]).showLevels).toBe(false)
  })

  it('counts every answered card, placed or not', () => {
    const s = summarize([
      out({ transition: 'entered', memoryDays: 3 }),
      out({ transition: 'held', memoryDays: 20 }),
      out({ transition: 'slipped', memoryDays: 1 }),
      out({ transition: 'met', memoryDays: null }),
    ])
    expect(s.total).toBe(4)
    expect(s.transitions).toEqual({ entered: 1, held: 1, slipped: 1, met: 1 })
    // The unplaceable one still counts as a card, just not as a bar.
    expect(s.levels.reduce((a, b) => a + b, 0)).toBe(3)
  })
})

describe('judgesDifficulty', () => {
  it('only speaks for a sitting that carried new material', () => {
    expect(judgesDifficulty(6)).toBe(true)
    // The regression this exists for: comfort is folded from learn + stretch
    // alone, so a review-only sitting leaves it untouched and showing its band
    // captions THIS session with a reading taken days ago.
    expect(judgesDifficulty(0)).toBe(false)
  })
})
