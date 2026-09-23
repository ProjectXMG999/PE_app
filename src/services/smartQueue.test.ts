import { describe, it, expect } from 'vitest'
import {
  smartTargetCount, smartSessionSize, measuredCardsPerMin,
  selectSmart, composeSmartSteps, previewOf, smartPeek, smartReason, SMART, PACE, SmartSelection,
} from './smartQueue'
import { HEALTH, ReviewHealth } from './reviewHealth'
import type { ProgressSnapshot } from '../hooks/useProgressData'
import type { Session, WordProgress } from '../types/progress'
import type { Pack, PackMeta, Word } from '../types/vocabulary'
import packagesIndex from '../data/packages-index.json'
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

  // `allowLevelStretch` is passed explicitly here and below: these cover the
  // stretch RULES, which outlive the LEVEL_STRETCH_ENABLED switch currently
  // holding the stream off. Flipping it must not require editing these.
  it('adds a stretch pack only once comfort clears the learn pack level by STRETCH_MARGIN', () => {
    const snapshot = baseSnapshot()
    const args = { snapshot, todayLevel: 1, goalSec: 15 * 60, allowLevelStretch: true }

    const noStretch = selectSmart({ ...args, comfortLevel: 1.0 })
    expect(noStretch.stretchPackId).toBeNull()

    const withStretch = selectSmart({ ...args, comfortLevel: 1.7 })
    expect(withStretch.stretchPackId).toBe(P111)
    expect(withStretch.quota.stretch).toBeGreaterThan(0)
  })

  it('never leaves the learner\'s own level while the stretch switch is off', () => {
    // Same input as the passing case above, minus the opt-in.
    const sel = selectSmart({
      snapshot: baseSnapshot(), comfortLevel: 1.7, todayLevel: 1, goalSec: 15 * 60,
    })
    expect(sel.stretchPackId).toBeNull()
    expect(sel.quota.stretch).toBe(0)
  })

  it('sizes the review slice by reviewRatio, not by today\'s serving budget', () => {
    const due = Array.from({ length: 5 }, (_, i) =>
      wp({ wordId: `due-${i}`, packageId: P003, nextReviewAt: '2026-06-01', reviewCount: 1 })
    )
    const args = { comfortLevel: 1.0, todayLevel: 1, goalSec: 15 * 60 } as const

    // A 15-minute sitting's reviewTarget comfortably exceeds five words, so the
    // slice takes all of them however much of the day's serving is left.
    const unspent = selectSmart({ snapshot: baseSnapshot({ dueWords: due, servingLeft: 20 }), ...args })
    expect(unspent.reviewWords).toHaveLength(5)

    // Clearing the queue in /powtorka used to zero this slice, which left every
    // Inteligentny sitting for the rest of that day as pure new material.
    // Reviews here displace learn cards rather than adding to the day, so the
    // serving budget does not gate them — and leftover-pack stragglers, which
    // never obeyed it, still ride along beyond the slice.
    const stragglerWord = wp({ wordId: `${P002}-010`, packageId: P002, status: 'learning' })
    const spent = selectSmart({
      snapshot: baseSnapshot({
        dueWords: due,
        servingLeft: 0,
        progressMap: new Map([[P002, { packageId: P002, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 9 }]]),
        knownMap: new Map([[P002, 9]]),
        wordProgress: [stragglerWord],
      }),
      ...args,
    })
    expect(spent.reviewWords).toHaveLength(6)
    expect(spent.reviewWords.filter(w => w.packageId === P003)).toHaveLength(5)
    expect(spent.reviewWords.map(w => w.wordId)).toContain(`${P002}-010`)
  })

  it('reaches a full sitting for a brand-new user without fanning out over the catalog', () => {
    const selection = selectSmart({ snapshot: baseSnapshot(), comfortLevel: 1.0, todayLevel: 1, goalSec: 3600 })
    // Nothing due and no stretch, so the whole sitting is learn: MAX_CARDS=40
    // plus LEARN_RESERVE=8 of slack, over 10-word level-1 packs, is 5 packs.
    // The learn stream must cover the quota (the old flat MAX_PACKS=8 used to
    // truncate it) without reaching for a dozen packs to do it — that fan-out
    // is what a session shows as "16 pakietów" and what makes the
    // /pack-content fetches pile up.
    expect(selection.quota.learn).toBe(SMART.MAX_CARDS)
    expect(selection.learnPackIds).toHaveLength(5)
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
  it('never asks the same word twice, even when it is both due and in a learn pack', () => {
    // A `learning` word that is due sits in reviewWords AND still lives in its
    // pack, whose only learn-stream filter is `status === 'known'`. It used to
    // come round twice in one sitting, both copies carrying the progress row
    // captured at build time — so the second answer was computed from the state
    // before the first and quietly overwrote it.
    const selection: SmartSelection = {
      targetCount: 4,
      size: sizeOf(4),
      quota: { learn: 3, review: 1, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: null,
      reviewWords: [wp({ wordId: 'p1-w1', packageId: 'p1', status: 'learning' })],
      packIds: ['p1'],
    }
    const packs = new Map([['p1', pack('p1', ['p1-w1', 'p1-w2', 'p1-w3', 'p1-w4'])]])

    const { steps } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    const ids = steps.flatMap(s => (s.kind === 'card' ? [s.word.id] : []))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter(id => id === 'p1-w1')).toHaveLength(1)
  })

  it('weaves warmup → review hand-off → stretch hand-off, with no info card for an empty segment', () => {
    const selection: SmartSelection = {
      targetCount: 6,
      size: sizeOf(6),
      quota: { learn: 3, review: 1, stretch: 2 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
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

  /* An info step explains why what's being asked of you just changed. First in
   * the queue there is no change to explain, and it stopped being a hand-off:
   * it became a second opening screen, stacked over the curtain (which is
   * still up for OPENER_MIN_MS after the session settles) and read through its
   * own translucent scrim. The curtain announces the opening segment instead —
   * that is what `opensWith` is for. */
  it('never opens on a hand-off card, and reports what it opens with instead', () => {
    const selection: SmartSelection = {
      targetCount: 3,
      size: sizeOf(3),
      // No room for new words at all — a review-heavy day, the case that put an
      // info card at step 0.
      quota: { learn: 0, review: 3, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: null,
      reviewWords: [
        wp({ wordId: 'p3-w1', packageId: 'p3' }),
        wp({ wordId: 'p3-w2', packageId: 'p3' }),
        wp({ wordId: 'p3-w3', packageId: 'p3' }),
      ],
      packIds: ['p1', 'p3'],
    }
    const packs = new Map([
      ['p1', pack('p1', ['p1-w1', 'p1-w2'])],
      ['p3', pack('p3', ['p3-w1', 'p3-w2', 'p3-w3'])],
    ])

    const { steps, opensWith } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(steps.map(s => (s.kind === 'card' ? s.segment : `info:${s.variant}`)))
      .toEqual(['review', 'review', 'review'])
    expect(opensWith).toEqual({ segment: 'review', count: 3 })
  })

  /* The same hazard on the stretch side: an empty warmup with no reviews puts
   * `info:stretch-ahead` first. */
  it('never opens on a stretch hand-off either', () => {
    const selection: SmartSelection = {
      targetCount: 2,
      size: sizeOf(2),
      quota: { learn: 0, review: 0, stretch: 2 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: 'p2',
      reviewWords: [],
      packIds: ['p1', 'p2'],
    }
    const packs = new Map([
      ['p1', pack('p1', ['p1-w1'])],
      ['p2', pack('p2', ['p2-w1', 'p2-w2'])],
    ])

    const { steps, opensWith } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(steps.every(s => s.kind === 'card')).toBe(true)
    expect(opensWith).toEqual({ segment: 'stretch', count: 2 })
  })

  /* `opensWith.count` is the OPENING BLOCK, not the segment's total: "zaczynamy
   * od powtórki, 8 słów" has to mean the eight you are about to do. */
  it('counts only the opening block, not the segment total', () => {
    const selection: SmartSelection = {
      targetCount: 5,
      size: sizeOf(5),
      quota: { learn: 2, review: 3, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
      tone: null,
      learnPackIds: ['p1'],
      stretchPackId: null,
      reviewWords: [wp({ wordId: 'p3-w1', packageId: 'p3' })],
      packIds: ['p1', 'p3'],
    }
    const packs = new Map([
      ['p1', pack('p1', ['p1-w1', 'p1-w2'])],
      ['p3', pack('p3', ['p3-w1'])],
    ])

    const { steps, opensWith } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(steps[0].kind).toBe('card')
    // Two learn cards open it; the review that follows is behind a hand-off.
    expect(opensWith).toEqual({ segment: 'learn', count: 2 })
  })

  it('produces plain card steps with no info cards when only one segment is present', () => {
    const selection: SmartSelection = {
      targetCount: 3,
      size: sizeOf(3),
      quota: { learn: 3, review: 0, stretch: 0 },
      reviewRatio: SMART.REVIEW_RATIO,
      learnExhausted: false,
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
      learnExhausted: false,
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

  it('serves reviews after the day\'s budget is spent, whatever health says', () => {
    // servingLeft 0 means /powtorka's serving for today is done. The reviews
    // cost no extra time here (they displace learn cards), so the slice still
    // fills for both learners — health moves its SIZE, it does not gate it.
    const spent = dueSnapshot({ servingLeft: 0, served: 20 })
    const weak = selectSmart({ snapshot: spent, comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.7) })
    const strong = selectSmart({ snapshot: spent, comfortLevel: 1, todayLevel: 1, goalSec, reviewHealth: health(0.97) })
    expect(strong.quota.review).toBeGreaterThan(0)
    expect(strong.quota.review).toBeLessThan(weak.quota.review)
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
    const args = {
      snapshot: dueSnapshot(), comfortLevel: 2, todayLevel: 1, goalSec, allowLevelStretch: true,
    }
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

describe('previewOf / smartPeek', () => {
  const args = { snapshot: baseSnapshot(), comfortLevel: 2, todayLevel: 1, goalSec: 15 * 60 }

  it('matches smartPeek for the same selection — the split is a refactor, not a change', () => {
    expect(previewOf(selectSmart(args))).toEqual(smartPeek(args))
  })

  it('reports stretch as 0 when no stretch pack was chosen, whatever the quota says', () => {
    const sel = selectSmart({ ...args, comfortLevel: 1 })
    expect(sel.stretchPackId).toBeNull()
    expect(previewOf(sel).stretch).toBe(0)
  })

  it('explains itself only when the mix actually moved', () => {
    const baseline = smartPeek(args)
    expect(baseline.adapted).toBe(false)
    expect(smartReason(baseline)).toBeNull()

    // A bonus session is a departure worth a sentence even when the ratio held.
    expect(smartReason({ ...baseline, bonus: true })).toContain('Cel na dziś')
    expect(smartReason({ ...baseline, adapted: true, tone: 'strong' })).toContain('nowych słów')
    expect(smartReason({ ...baseline, adapted: true, tone: 'slipping' })).toContain('powtórek')
  })
})

/**
 * The reported failure, in one place: a sitting announced as 14 words that
 * opens on a single card and ends there, every time it is rebuilt.
 *
 * Nothing about the selection is wrong — the queue picks a full session. The
 * cards are lost downstream, in composition: a review word becomes a card only
 * if its pack arrived and still holds that word id, and the slot it had already
 * been given was never handed to anything else.
 */
describe('a session whose review content never arrives', () => {
  const REVIEW_PACK = 'gone-pack'

  function shortSelection(): SmartSelection {
    return {
      targetCount: 14,
      size: sizeOf(14),
      // The shape selectSmart produces on a slipping-health day: review takes
      // most of the sitting, new words get what's left.
      quota: { learn: 1, review: 13, stretch: 0 },
      reviewRatio: 0.65,
      learnExhausted: false,
      tone: 'slipping',
      learnPackIds: ['learn1', 'learn2'],
      stretchPackId: null,
      reviewWords: Array.from({ length: 13 }, (_, i) =>
        wp({ wordId: `${REVIEW_PACK}-w${i}`, packageId: REVIEW_PACK })),
      packIds: ['learn1', 'learn2', REVIEW_PACK],
    }
  }

  /** Everything the session asked for EXCEPT the review pack — one failed fetch. */
  const arrived = () => new Map([
    ['learn1', pack('learn1', Array.from({ length: 10 }, (_, i) => `learn1-w${i}`))],
    ['learn2', pack('learn2', Array.from({ length: 10 }, (_, i) => `learn2-w${i}`))],
  ])

  it('fills the sitting from the packs that did arrive instead of shrinking to one card', () => {
    const { steps, counts } = composeSmartSteps({
      selection: shortSelection(),
      packs: arrived(),
      wordProgressById: new Map(),
    })

    const cards = steps.filter(s => s.kind === 'card')
    expect(counts.review).toBe(0)
    // Was 1 — quota.learn, with the 13 review slots evaporating in silence.
    expect(cards).toHaveLength(14)
    expect(counts.learn).toBe(14)
  })

  it('names what went missing, and tells a failed download from a stale row', () => {
    const selection = shortSelection()
    const packs = arrived()
    // The pack arrives, but holds none of the word ids the queue asked for.
    packs.set(REVIEW_PACK, pack(REVIEW_PACK, ['something-else']))

    const withPack = composeSmartSteps({ selection, packs, wordProgressById: new Map() })
    expect(withPack.unresolved).toHaveLength(13)
    expect(withPack.unresolved.every(u => u.reason === 'word')).toBe(true)

    const withoutPack = composeSmartSteps({
      selection, packs: arrived(), wordProgressById: new Map(),
    })
    expect(withoutPack.unresolved.every(u => u.reason === 'pack')).toBe(true)
  })

  it('still honours the quota when every stream does arrive', () => {
    const selection = shortSelection()
    const packs = arrived()
    packs.set(REVIEW_PACK, pack(REVIEW_PACK, selection.reviewWords.map(w => w.wordId)))

    const { counts } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(counts).toEqual({ learn: 1, review: 13, stretch: 0 })
  })

  it('backfills a partial arrival too — the remainder is what is missing, not the whole slice', () => {
    const selection = shortSelection()
    const packs = arrived()
    // Four of the thirteen review words survive.
    packs.set(REVIEW_PACK, pack(REVIEW_PACK, selection.reviewWords.slice(0, 4).map(w => w.wordId)))

    const { counts } = composeSmartSteps({ selection, packs, wordProgressById: new Map() })

    expect(counts.review).toBe(4)
    expect(counts.learn).toBe(10)
  })
})

describe('due words whose pack has left the catalog', () => {
  const goalSec = 15 * 60

  it('never reserve a slot they cannot fill', () => {
    const ghosts = Array.from({ length: 8 }, (_, i) =>
      wp({ wordId: `ghost-w${i}`, packageId: 'no-such-pack', status: 'known', nextReviewAt: '2020-01-01' }))
    const sel = selectSmart({
      snapshot: baseSnapshot({ dueWords: ghosts, wordProgress: ghosts }),
      comfortLevel: 1,
      todayLevel: 1,
      goalSec,
    })

    expect(sel.reviewWords).toHaveLength(0)
    // The whole sitting goes to words that can actually be shown.
    expect(sel.quota.learn).toBe(sel.targetCount)
  })
})

/**
 * The quota is a remainder of the daily goal; the catalogue is what can
 * actually be served. When those two disagreed, every screen believed the
 * remainder: Dzisiaj offered "29 nowych słów" — a 15-minute goal's worth of
 * cards — to a learner with nothing left to learn, and the session they tapped
 * into opened on "Nic do zrobienia".
 */
describe('a route with nothing (or almost nothing) left on it', () => {
  const catalogue = packagesIndex as PackMeta[]
  const goalSec = 15 * 60
  const args = { comfortLevel: 1, todayLevel: 1, goalSec } as const

  it('promises no new words once every pack is fully known', () => {
    const sel = selectSmart({
      snapshot: baseSnapshot({ knownMap: new Map(catalogue.map(p => [p.id, p.wordCount])) }),
      ...args,
    })

    expect(sel.learnPackIds).toHaveLength(0)
    expect(sel.packIds).toHaveLength(0)
    expect(sel.targetCount).toBeGreaterThan(0) // the sitting was still sized…
    expect(sel.quota.learn).toBe(0) // …but sizing a sitting is not finding words
    expect(previewOf(sel).learn).toBe(0)
  })

  /**
   * The reported screen: every word in the app learned, 53 due, review health
   * "strong" — and Dzisiaj offered a 7-card sitting captioned "Powtórki idą ci
   * świetnie, więc dziś więcej nowych słów."
   *
   * Both halves came from the same place. `reviewRatio` shrank the review slice
   * to buy new words, the learn quota then clamped to 0 against an empty
   * catalogue, and nothing claimed the slots the ratio had set aside — so the
   * ratio, which exists to stop review crowding out new material, became a
   * ceiling on the whole session instead.
   */
  describe('and a queue of due words behind it', () => {
    const allKnown = new Map(catalogue.map(p => [p.id, p.wordCount]))
    const dueWords = Array.from({ length: 53 }, (_, i) =>
      wp({ wordId: `${P003}-${i}`, packageId: P003, status: 'known', nextReviewAt: '2020-01-01', stability: 10 })
    )
    const strong: ReviewHealth = { value: 0.97, samples: HEALTH.MIN_SAMPLES, updatedAt: dayKey() }
    const sel = selectSmart({
      snapshot: baseSnapshot({ knownMap: allKnown, dueWords, dueCount: dueWords.length }),
      ...args,
      reviewHealth: strong,
    })

    it('fills the sitting with review instead of shrinking it', () => {
      expect(sel.quota.learn).toBe(0)
      expect(sel.quota.review).toBe(sel.targetCount)
      // The ratio still decides the MIX; it no longer decides the SIZE.
      expect(sel.quota.review).toBeGreaterThan(Math.round(sel.targetCount * sel.reviewRatio))
    })

    it('does not promise new words it has none of', () => {
      const reason = smartReason(previewOf(sel))
      expect(reason).not.toContain('więcej nowych słów')
      expect(reason).toContain('utrwalamy')
    })

    it('still takes the most urgent words first, and each only once', () => {
      const ids = sel.reviewWords.map(w => w.wordId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every(id => dueWords.some(d => d.wordId === id))).toBe(true)
    })
  })

  it('caps the learn quota at the words the last unfinished pack still holds', () => {
    const knownMap = new Map(catalogue.map(p => [p.id, p.wordCount]))
    knownMap.set(P003, 7) // 3 words left in the whole catalogue

    const sel = selectSmart({ snapshot: baseSnapshot({ knownMap }), ...args })

    expect(sel.learnPackIds).toEqual([P003])
    expect(sel.quota.learn).toBe(3)
    expect(sel.quota.learn).toBeLessThan(sel.targetCount)
  })
})

describe('learn supply', () => {
  it('lines up more words than the quota, so one dead pack cannot empty the stream', () => {
    const sel = selectSmart({
      snapshot: baseSnapshot(),
      comfortLevel: 1,
      todayLevel: 1,
      goalSec: 15 * 60,
    })
    const supply = sel.learnPackIds.length * 10 // level-1 packs hold 10 words
    expect(supply).toBeGreaterThanOrEqual(sel.quota.learn + SMART.LEARN_RESERVE)
  })
})
