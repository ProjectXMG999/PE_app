import { describe, expect, it } from 'vitest'
import { studyDayKeys, studySecondsByDay, streakFrom, MIN_STUDY_SEC } from './studyDays'
import { DailyTime, Session } from '../types/progress'

function session(date: string, wordsCompleted = 10, durationSec?: number): Session {
  return {
    id: Math.random(),
    packageId: 'p1',
    date,
    startedAt: `${date}T10:00:00.000Z`,
    wordsCompleted,
    mode: 'fiszki',
    durationSec,
  } as Session
}

function day(date: string, secondsStudied: number): DailyTime {
  return { date, secondsStudied, goalSec: 600, goalMetAt: null }
}

/** Day-key arithmetic for the plain 'YYYY-MM-DD' keys used in these tests. */
function prevDay(key: string): string {
  const d = new Date(key + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

describe('studyDayKeys', () => {
  it('counts a day with real study time but no finished session', () => {
    // The exact case the Postęp page contradicted itself on: the daily-goal
    // badge counted these days, the streak and the heatmap did not.
    const days = studyDayKeys([], [day('2026-09-01', 20 * 60)])
    expect([...days]).toEqual(['2026-09-01'])
  })

  it('ignores a day the user merely opened the app on', () => {
    const days = studyDayKeys([], [day('2026-09-01', MIN_STUDY_SEC - 1)])
    expect(days.size).toBe(0)
  })

  it('counts a finished session even with no ledger row (pre-ledger history)', () => {
    const days = studyDayKeys([session('2026-08-01')], [])
    expect([...days]).toEqual(['2026-08-01'])
  })

  it('does not double-count a day recorded in both', () => {
    const days = studyDayKeys([session('2026-09-02')], [day('2026-09-02', 600)])
    expect(days.size).toBe(1)
  })
})

describe('studySecondsByDay', () => {
  it('prefers the ledger over session durations', () => {
    const byDay = studySecondsByDay([session('2026-09-02', 10, 90)], [day('2026-09-02', 1200)])
    expect(byDay.get('2026-09-02')).toBe(1200)
  })

  it('falls back to session duration where the ledger has no row', () => {
    const byDay = studySecondsByDay([session('2026-08-01', 10, 90)], [])
    expect(byDay.get('2026-08-01')).toBe(90)
  })

  it('estimates for sessions written before durationSec existed', () => {
    const byDay = studySecondsByDay([session('2026-08-01', 10)], [])
    expect(byDay.get('2026-08-01')).toBe(80)
  })
})

describe('streakFrom', () => {
  const days = (...d: string[]) => new Set(d)

  it('counts back from today', () => {
    const studied = days('2026-09-11', '2026-09-10', '2026-09-09')
    expect(streakFrom(studied, new Set(), '2026-09-11', prevDay)).toBe(3)
  })

  it('stays alive when today has not been studied yet', () => {
    const studied = days('2026-09-10', '2026-09-09')
    expect(streakFrom(studied, new Set(), '2026-09-11', prevDay)).toBe(2)
  })

  it('breaks once two days are missed', () => {
    const studied = days('2026-09-08', '2026-09-07')
    expect(streakFrom(studied, new Set(), '2026-09-11', prevDay)).toBe(0)
  })

  it('bridges a gap with a freeze without counting it as study', () => {
    const studied = days('2026-09-11', '2026-09-09')
    const frozen = days('2026-09-10')
    expect(streakFrom(studied, frozen, '2026-09-11', prevDay)).toBe(2)
  })

  it('is zero with no history', () => {
    expect(streakFrom(new Set(), new Set(), '2026-09-11', prevDay)).toBe(0)
  })
})
