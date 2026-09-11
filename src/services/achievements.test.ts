import { describe, expect, it } from 'vitest'
import { computeMetrics } from './achievements'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { DailyTime, Session } from '../types/progress'
import { PackMeta } from '../types/vocabulary'

/**
 * Guards the metrics that the Postęp page displays twice — once as a badge
 * threshold and once as a figure of its own. Each of these was, at some point,
 * computed one way for the badge and another for the tile, which is how the
 * page ended up awarding "100 słów odsłuchanych" next to a panel reading 75.
 */

function session(over: Partial<Session> = {}): Session {
  return {
    id: Math.random(),
    packageId: 'p1',
    date: '2026-09-10',
    startedAt: '2026-09-10T10:00:00.000Z',
    wordsCompleted: 25,
    mode: 'fiszki',
    ...over,
  } as Session
}

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    packageProgress: [],
    progressMap: new Map(),
    wordProgress: [],
    knownMap: new Map(),
    knownTotal: 0,
    bulkKnownTotal: 0,
    dueCount: 0,
    dueWords: [],
    servingLeft: 0,
    reviewBudget: 0,
    served: 0,
    retiredCount: 0,
    staleCount: 0,
    reviewUrgency: 'calm',
    reviewTotal: 0,
    reviewLedger: [],
    sessions: [],
    streak: 0,
    ...over,
  } as ProgressSnapshot
}

const pack = (id: string, category: string): PackMeta =>
  ({ id, category, level: 1, wordCount: 10, volume: 'Tom I', chapter: '1' }) as PackMeta

const base = { allPacks: [] as PackMeta[], dailyTime: [] as DailyTime[], longestStreak: 0, bestDayCount: 0 }

describe('wordsHeard', () => {
  it('counts only Słuchaj sessions, matching the "Odsłuchane" figure', () => {
    const metrics = computeMetrics({
      ...base,
      snapshot: snapshot({
        sessions: [
          session({ mode: 'autoplay', wordsCompleted: 75 }),
          session({ mode: 'fiszki', wordsCompleted: 40 }),
        ],
      }),
    })
    expect(metrics.wordsHeard).toBe(75)
  })
})

describe('minutes', () => {
  it('reads the daily-time ledger, so it matches "Czas nauki"', () => {
    // 20 minutes studied, nothing finished — the badge has to see it.
    const metrics = computeMetrics({
      ...base,
      snapshot: snapshot({ sessions: [] }),
      dailyTime: [{ date: '2026-09-10', secondsStudied: 1200, goalSec: 600, goalMetAt: null }],
    })
    expect(metrics.minutes).toBe(20)
  })

  it('falls back to session durations for days the ledger never saw', () => {
    const metrics = computeMetrics({
      ...base,
      snapshot: snapshot({ sessions: [session({ date: '2026-08-01', durationSec: 600 })] }),
    })
    expect(metrics.minutes).toBe(10)
  })
})

describe('categoriesStarted', () => {
  it('counts a category only once it has a known word', () => {
    // Opening a pack used to be enough, so "Wszędzie byłem — 11/12" could sit
    // next to three category bars reading 0 %.
    const allPacks = [pack('a', 'Rzeczowniki'), pack('b', 'Phrasale')]
    const metrics = computeMetrics({
      ...base,
      allPacks,
      snapshot: snapshot({
        knownMap: new Map([['a', 4]]),
        packageProgress: [
          { packageId: 'a', startedAt: '', currentIndex: 4, masteredAt: null },
          { packageId: 'b', startedAt: '', currentIndex: 0, masteredAt: null },
        ] as ProgressSnapshot['packageProgress'],
      }),
    })
    expect(metrics.categoriesStarted).toBe(1)
  })
})

describe('weekendRun', () => {
  it('counts a weekend studied through the ledger alone', () => {
    // 2026-09-05 is a Saturday.
    const metrics = computeMetrics({
      ...base,
      snapshot: snapshot({ sessions: [] }),
      dailyTime: [{ date: '2026-09-05', secondsStudied: 900, goalSec: 600, goalMetAt: null }],
    })
    expect(metrics.weekendRun).toBe(1)
  })
})
