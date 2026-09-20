import { describe, it, expect } from 'vitest'
import {
  smartTargetCount, smartSessionSize, measuredCardsPerMin,
  selectSmart, composeSmartSteps, SMART, PACE, SmartSelection,
} from './smartQueue'
import { HEALTH, ReviewHealth } from './reviewHealth'
import type { ProgressSnapshot } from '../hooks/useProgressData'
import type { Session, WordProgress } from '../types/progress'
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
    declaredKnownTotal: 0,
    declaredKnownMap: new Map(),
    declaredRetiredCount: 0,
    dueCount: 0,
    dueWords: [],
    servingLeft: 20,
    reviewBudget: 20,
    reviewSecPerCard: 10,
    served: 0,
    maintenanceLoad: { perDay: 0, minutesPerDay: 0, coveredPct: 0 },
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

describe('measuredCardsPerMin', () => {
  const today = '2026-06-10'
  function rated(date: string, ratedCount: number, durationSec: number): Session {
    return { packageId: 'p', date, wordsCompleted: ratedCount, mode: 'fiszki', ratedCount, durationSec }
  }

  it('returns null until there is enough recent evidence', () => {
    expect(measuredCardsPerMin([], today)).toBeNull()
    // Two sessions is below PACE.MIN_SESSIONS however many cards they hold.
    expect(measuredCardsPerMin([rated(today, 40, 1200), rated(today, 40, 1200)], today)).toBeNull()
    // Enough sessions, but outside the window.
    const old = Array.from({ length: 4 }, () => rated('2026-01-01', 30, 1200))
    expect(measuredCardsPerMin(old, today)).toBeNull()
  })

  it('reads the real cards-per-minute once there is', () => {
    // 4 sessions × 30 cards in 20 min = 1.5 cards/min.
    const sessions = Array.from({ length: 4 }, () => rated(today, 30, 1200))
    expect(measuredCardsPerMin(sessions, today)).toBeCloseTo(1.5, 5)
  })

  it('ignores autoplay and sessions too short to time honestly', () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => rated(today, 30, 1200)), // 1.5/min
      { packageId: 'p', date: today, wordsCompleted: 200, mode: 'autoplay' as const, ratedCount: 200, durationSec: 60 },
      rated(today, 3, 600), // a phone put down, not a pace
    ]
    expect(measuredCardsPerMin(sessions, today)).toBeCloseTo(1.5, 5)
  })

  it('clamps a clock artefact into the plausible band', () => {
    const stuck = Array.from({ length: 4 }, () => rated(today, 40, 36_000)) // 10 h "session"
    expect(measuredCardsPerMin(stuck, today)).toBe(PACE.MIN)
  })
})

describe('smartSessionSize', () => {
  const goalSec = 3600 // the biggest goal on the picker — where the old wall appeared

  it('sizes one sitting, not the whole day', () => {
    const size = smartSessionSize({ goalSec })
    expect(size.dailyTarget).toBe(Math.round(60 * SMART.CARDS_PER_MIN))
    expect(size.targetCount).toBe(SMART.MAX_CARDS)
    expect(size.targetCount).toBeLessThan(size.dailyTarget)
  })

  it('offers what is LEFT of the day after an earlier sitting', () => {
    const pace = SMART.CARDS_PER_MIN
    const daily = Math.round(60 * pace)
    // 50 minutes already studied today, whatever finished or not.
    const size = smartSessionSize({ goalSec, secondsStudiedToday: 50 * 60 })
    expect(size.doneToday).toBe(Math.round(50 * pace))
    expect(size.remaining).toBe(daily - Math.round(50 * pace))
    expect(size.targetCount).toBeLessThan(SMART.MAX_CARDS)
    expect(size.bonus).toBe(false)
  })

  it('drops to a short extra once the goal is met, instead of a fresh full session', () => {
    const size = smartSessionSize({ goalSec, secondsStudiedToday: 90 * 60 })
    expect(size.remaining).toBe(0)
    expect(size.bonus).toBe(true)
    expect(size.targetCount).toBe(SMART.MIN_CARDS)
  })

  it('prefers the learner\'s measured pace over the cold-start constant', () => {
    const today = dayKey()
    // 4 sessions at 1.0 cards/min — slower than CARDS_PER_MIN, so a smaller day.
    const sessions: Session[] = Array.from({ length: 4 }, () => ({
      packageId: 'p', date: today, wordsCompleted: 20, mode: 'fiszki', ratedCount: 20, durationSec: 1200,
    }))
    const measured = smartSessionSize({ goalSec, sessions, today })
    expect(measured.pace).toBeCloseTo(1.0, 5)
    expect(measured.dailyTarget).toBeLessThan(smartSessionSize({ goalSec }).dailyTarget)
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

  it('reaches a full sitting for a brand-new user without fanning out over the catalog', () => {
    const selection = selectSmart({ snapshot: baseSnapshot(), comfortLevel: 1.0, todayLevel: 1, goalSec: 3600 })
    // Nothing due and no stretch, so the whole sitting is learn: MAX_CARDS=40
    // over 10-word level-1 packs is 4 packs. The learn stream must cover the
    // quota (the old flat MAX_PACKS=8 used to truncate it) without reaching for
    // a dozen packs to do it — that fan-out is what a session shows as
    // "16 pakietów" and what makes the /pack-content fetches pile up.
    expect(selection.quota.learn).toBe(SMART.MAX_CARDS)
    expect(selection.learnPackIds).toHaveLength(4)
  })

  it('orders straggler words by how close their pack is to completion', () => {
    const snapshot = baseSnapshot({
      progressMap: new Map([
        [P001, { packageId: P001, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 9 }],
        [P002, { packageId: P002, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 8 }],
      ]),
      knownMap: new Map([[P001, 9], [P002, 8]]), // p001: 1 word left, p002: 2 words left
      wordProgress: [
        wp({ wordId: 'b-word-1', packageId: P002, status: 'learning' }),
        wp({ wordId: 'a-word', packageId: P001, status: 'learning' }),
        wp({ wordId: 'b-word-2', packageId: P002, status: 'learning' }),
      ],
    })

    const sel = selectSmart({ snapshot, comfortLevel: 1, todayLevel: 1, goalSec: 15 * 60 })

    const orderedIds = sel.reviewWords.map(w => w.wordId)
    expect(orderedIds.indexOf('a-word')).toBeLessThan(orderedIds.indexOf('b-word-1'))
    expect(orderedIds.indexOf('a-word')).toBeLessThan(orderedIds.indexOf('b-word-2'))
  })

  it('caps the straggler overflow instead of letting it swell review toward half the session', () => {
    const stragglerIds = Array.from({ length: 60 }, (_, i) => `t1-p${String(i + 1).padStart(3, '0')}`)
    const progressMap = new Map(stragglerIds.map(id =>
      [id, { packageId: id, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 9 }]
    ))
    const knownMap = new Map(stragglerIds.map(id => [id, 9])) // 1 word left in each
    const wordProgress = stragglerIds.map(id => wp({ wordId: `${id}-last`, packageId: id, status: 'learning' }))

    const snapshot = baseSnapshot({ progressMap, knownMap, wordProgress, servingLeft: 0 })
    const sel = selectSmart({ snapshot, comfortLevel: 1, todayLevel: 1, goalSec: 3600 })

    // A full sitting is MAX_CARDS at base reviewRatio=0.35. An earlier cap
    // (ceil(targetCount*0.5)) would have let far more of the 60 stragglers ride
    // along; the overflow is a flat SMART.STRAGGLER_OVERFLOW instead.
    const reviewTarget = Math.round(SMART.MAX_CARDS * SMART.REVIEW_RATIO)
    expect(sel.reviewWords).toHaveLength(reviewTarget + SMART.STRAGGLER_OVERFLOW)
    expect(sel.reviewWords.length).toBeLessThan(Math.ceil(SMART.MAX_CARDS * 0.5))
  })
})

/** A fixed-size sitting, for compose tests that don't care how it was sized. */
function sizeOf(targetCount: number) {
  return {
    targetCount,
    pace: SMART.CARDS_PER_MIN,
    dailyTarget: targetCount,
    doneToday: 0,
    remaining: targetCount,
    bonus: false,
  }
}

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
      size: sizeOf(6),
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
      size: sizeOf(3),
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
      size: sizeOf(2),
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

  it('serves due words when the backlog is urgent even with no fresh review-health signal', () => {
    // A returning learner: no reviewHealth passed → EMPTY_REVIEW_HEALTH →
    // reviewRatioFor falls back to base, same as a stale/thin signal would.
    // reviewUrgency, computed straight from the live backlog, still says
    // 'urgent' — and the day's /powtorka budget is already spent.
    const urgentSpent = dueSnapshot({ reviewUrgency: 'urgent', servingLeft: 0, served: 20 })
    const sel = selectSmart({ snapshot: urgentSpent, comfortLevel: 1, todayLevel: 1, goalSec })
    expect(sel.reviewRatio).toBe(SMART.REVIEW_RATIO)
    expect(sel.quota.review).toBeGreaterThan(0)
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
