import { describe, it, expect } from 'vitest'
import { smartTargetCount, selectSmart, composeSmartSteps, SMART, SmartSelection } from './smartQueue'
import { HEALTH, ReviewHealth } from './reviewHealth'
import type { ProgressSnapshot } from '../hooks/useProgressData'
import type { WordProgress } from '../types/progress'
import type { Pack, Word } from '../types/vocabulary'
import { dayKey } from '../utils/day'

// Real fixtures from the current catalog (src/data/packages-index.json):
// t1-p001..t1-p005 are level 1, wordCount 10; t1-p111 is the first level-2 pack.
const P001 = 't1-p001'
const P002 = 't1-p002'
const P003 = 't1-p003'
const P111 = 't1-p111'

function baseSnapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    packageProgress: [],
    progressMap: new Map(),
    wordProgress: [],
    knownMap: new Map(),
    knownTotal: 0,
    bulkKnownTotal: 0,
    dueCount: 0,
    dueWords: [],
    servingLeft: 20,
    reviewBudget: 20,
    served: 0,
    retiredCount: 0,
    staleCount: 0,
    reviewUrgency: 'calm',
    reviewTotal: 0,
    reviewLedger: [],
    sessions: [],
    streak: 0,
    ...overrides,
  }
}

function wp(overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    wordId: 'w', packageId: P001, seenCount: 1, lastSeen: '2026-06-01T00:00:00Z',
    status: 'learning', ...overrides,
  }
}

describe('smartTargetCount', () => {
  it('clamps to [MIN_CARDS, MAX_CARDS]', () => {
    expect(smartTargetCount(0)).toBe(SMART.MIN_CARDS)
    expect(smartTargetCount(3600)).toBe(SMART.MAX_CARDS)
  })
})

describe('selectSmart', () => {
  it('skips a fully-known pack and a straggler pack from the learn stream, and folds the straggler word into review', () => {
    const snapshot = baseSnapshot({
      progressMap: new Map([
        [P001, { packageId: P001, startedAt: '2026-05-01', completedAt: null, masteredAt: '2026-05-02', currentIndex: 10 }],
        [P002, { packageId: P002, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 9 }],
      ]),
      knownMap: new Map([[P001, 10], [P002, 9]]), // p001 fully known, p002 has 1 left (straggler)
      wordProgress: [wp({ wordId: `${P002}-010`, packageId: P002, status: 'learning' })],
    })

    const selection = selectSmart({ snapshot, comfortLevel: 1.0, todayLevel: 1, goalSec: 15 * 60 })

    expect(selection.learnPackIds).not.toContain(P001)
    expect(selection.learnPackIds).not.toContain(P002)
    expect(selection.learnPackIds[0]).toBe(P003) // earliest not-fully-known, non-straggler pack
    expect(selection.reviewWords.map(w => w.wordId)).toContain(`${P002}-010`)
  })

  it('adds a stretch pack only once comfort clears the learn pack level by STRETCH_MARGIN', () => {
    const snapshot = baseSnapshot()

    const noStretch = selectSmart({ snapshot, comfortLevel: 1.0, todayLevel: 1, goalSec: 15 * 60 })
    expect(noStretch.stretchPackId).toBeNull()

    const withStretch = selectSmart({ snapshot, comfortLevel: 1.7, todayLevel: 1, goalSec: 15 * 60 })
    expect(withStretch.stretchPackId).toBe(P111)
    expect(withStretch.quota.stretch).toBeGreaterThan(0)
  })

  it('caps real due words at servingLeft but never blocks leftover-pack words on the serving budget', () => {
    const due = Array.from({ length: 5 }, (_, i) =>
      wp({ wordId: `due-${i}`, packageId: P003, nextReviewAt: '2026-06-01', reviewCount: 1 })
    )

    const capped = selectSmart({
      snapshot: baseSnapshot({ dueWords: due, servingLeft: 2 }),
      comfortLevel: 1.0, todayLevel: 1, goalSec: 15 * 60,
    })
    expect(capped.reviewWords).toHaveLength(2)

    const stragglerWord = wp({ wordId: `${P002}-010`, packageId: P002, status: 'learning' })
    const zeroBudget = selectSmart({
      snapshot: baseSnapshot({
        dueWords: due,
        servingLeft: 0,
        progressMap: new Map([[P002, { packageId: P002, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 9 }]]),
        knownMap: new Map([[P002, 9]]),
        wordProgress: [stragglerWord],
      }),
      comfortLevel: 1.0, todayLevel: 1, goalSec: 15 * 60,
    })
    expect(zeroBudget.reviewWords.map(w => w.wordId)).toEqual([`${P002}-010`])
  })
})

function word(id: string): Word {
  return { id, english: id, polish: id, sentenceEn: null, sentencePl: null, audioWord: '', audioSentence: '' }
}

function pack(id: string, wordIds: string[]): Pack {
  return { id, name: id, volume: 'Tom I', level: 1, category: 'Test', wordCount: wordIds.length, chapter: 'I', words: wordIds.map(word) }
}

describe('composeSmartSteps', () => {
  it('weaves warmup → review hand-off → stretch hand-off, with no info card for an empty segment', () => {
    const selection: SmartSelection = {
      targetCount: 6,
      quota: { learn: 3, review: 1, stretch: 2 },
      reviewRatio: SMART.REVIEW_RATIO,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: 'p2',
      reviewWords: [wp({ wordId: 'p3-w1', packageId: 'p3' })],
      packIds: ['p1', 'p2', 'p3'],
    }
    const packs = new Map([
      ['p1', pack('p1', ['p1-w1', 'p1-w2', 'p1-w3', 'p1-w4'])],
      ['p2', pack('p2', ['p2-w1', 'p2-w2', 'p2-w3'])],
      ['p3', pack('p3', ['p3-w1'])],
    ])

    const { steps, counts, packCount } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(counts).toEqual({ learn: 3, review: 1, stretch: 2 })
    expect(packCount).toBe(3)

    const kinds = steps.map(s => (s.kind === 'card' ? s.segment : `info:${s.variant}`))
    expect(kinds).toEqual([
      'learn', 'learn', 'learn',
      'info:review-ahead', 'review',
      'info:stretch-ahead', 'stretch', 'stretch',
    ])
  })

  it('produces plain card steps with no info cards when only one segment is present', () => {
    const selection: SmartSelection = {
      targetCount: 3,
      quota: { learn: 3, review: 0, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: null,
      reviewWords: [],
      packIds: ['p1'],
    }
    const packs = new Map([['p1', pack('p1', ['p1-w1', 'p1-w2', 'p1-w3'])]])

    const { steps } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })
    expect(steps.every(s => s.kind === 'card')).toBe(true)
    expect(steps).toHaveLength(3)
  })

  it('skips words already known when pulling learn/stretch cards', () => {
    const selection: SmartSelection = {
      targetCount: 2,
      quota: { learn: 2, review: 0, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: null,
      reviewWords: [],
      packIds: ['p1'],
    }
    const packs = new Map([['p1', pack('p1', ['p1-w1', 'p1-w2', 'p1-w3'])]])
    const wordProgressById = new Map<string, WordProgress>([
      ['p1-w1', wp({ wordId: 'p1-w1', packageId: 'p1', status: 'known' })],
    ])

    const { steps } = composeSmartSteps({ selection, packs, wordProgressById })
    const ids = steps.filter(s => s.kind === 'card').map(s => (s as { word: Word }).word.id)
    expect(ids).toEqual(['p1-w2', 'p1-w3'])
  })
})

describe('selectSmart × review health', () => {
  /** Health parked at `value`, with enough samples and recent enough to act on. */
  function health(value: number): ReviewHealth {
    return { value, samples: HEALTH.MIN_SAMPLES, updatedAt: dayKey() }
  }

  /** 20 due words, all previously mastered — a queue big enough to see the
   *  review slice grow or shrink without running out of material. */
  function dueSnapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
    const dueWords = Array.from({ length: 20 }, (_, i) =>
      wp({ wordId: `${P003}-${i}`, packageId: P003, status: 'known', nextReviewAt: '2020-01-01', stability: 10 })
    )
    return baseSnapshot({ dueWords, dueCount: dueWords.length, servingLeft: 20, ...overrides })
  }

  const goalSec = 900 // 15 min → a mid-sized session, room to move either way

  it('spends less of the session on review when recall is strong', () => {
    const strong = selectSmart({ snapshot: dueSnapshot(), comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.97) })
    const neutral = selectSmart({ snapshot: dueSnapshot(), comfortLevel: 1, todayLevel: 1, goalSec })
    expect(strong.reviewRatio).toBeLessThan(neutral.reviewRatio)
    expect(strong.quota.review).toBeLessThan(neutral.quota.review)
    expect(strong.quota.learn).toBeGreaterThan(neutral.quota.learn)
  })

  it('spends more of it on review when recall is slipping', () => {
    const weak = selectSmart({ snapshot: dueSnapshot(), comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.7) })
    const neutral = selectSmart({ snapshot: dueSnapshot(), comfortLevel: 1, todayLevel: 1, goalSec })
    expect(weak.quota.review).toBeGreaterThan(neutral.quota.review)
    expect(weak.quota.learn).toBeLessThan(neutral.quota.learn)
  })

  it('serves the reviews a slipping learner needs even after the day\'s budget is spent', () => {
    // servingLeft 0 normally means "no due words today"; here the reviews cost
    // no extra time (they displace learn cards), so the slice still fills.
    const spent = dueSnapshot({ servingLeft: 0, served: 20 })
    const weak = selectSmart({ snapshot: spent, comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.7) })
    expect(weak.quota.review).toBeGreaterThan(0)

    // A learner who is doing fine still respects it — no reason to overrule.
    const strong = selectSmart({ snapshot: spent, comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.97) })
    expect(strong.quota.review).toBe(0)
  })

  it('does not let a strong run shrink the review slice while the backlog is urgent', () => {
    const urgent = dueSnapshot({ reviewUrgency: 'urgent' })
    const sel = selectSmart({ snapshot: urgent, comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.97) })
    expect(sel.reviewRatio).toBe(SMART.REVIEW_RATIO)
  })

  it('drops stretch words when retention is below the floor, however comfortable the level feels', () => {
    // comfortLevel 2 against a level-1 route is exactly the case that adds stretch.
    const args = { snapshot: dueSnapshot(), comfortLevel: 2, todayLevel: 1, goalSec }
    expect(selectSmart({ ...args, reviewHealth: health(0.95) }).stretchPackId).not.toBeNull()
    expect(selectSmart({ ...args, reviewHealth: health(HEALTH.STRETCH_FLOOR - 0.05) }).stretchPackId).toBeNull()
  })

  it('behaves exactly as before when there is not enough review evidence yet', () => {
    const thin: ReviewHealth = { value: 0.5, samples: HEALTH.MIN_SAMPLES - 1, updatedAt: dayKey() }
    const sel = selectSmart({ snapshot: dueSnapshot(), comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: thin })
    expect(sel.reviewRatio).toBe(SMART.REVIEW_RATIO)
    expect(sel.tone).toBeNull()
  })
})
