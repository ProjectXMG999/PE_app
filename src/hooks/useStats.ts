import { useState, useEffect, useCallback } from 'react'
import { DailyTime, DayActivity, Session } from '../types/progress'
import { nextLevelFromTotalKnown } from '../data/levels'
import { loadProgressSnapshot, avgWordsPerDay, avgWordsPerDayTrend, PaceTrend } from './useProgressData'
import { getLongestStreak, getBestDayWordCount } from '../services/db'
import { dayKey, shiftDay } from '../utils/day'

/** Fallback for sessions written before durationSec existed. */
const ESTIMATED_SECONDS_PER_WORD = 8

/**
 * Days of activity history built for the Postęp page. Four weeks, so the
 * heatmap can show a rhythm rather than a single week's worth of bars.
 * Consumers that only want a week take `activity.slice(-7)`.
 */
export const ACTIVITY_DAYS = 28

/**
 * Minutes studied. Sessions recorded since the daily-time work carry a measured
 * `durationSec`; older ones fall back to the words × 8 s estimate they were
 * always displayed with, so history doesn't visibly jump when this ships.
 */
export function studiedMinutes(sessions: Session[]): number {
  const seconds = sessions.reduce(
    (sum, s) => sum + (s.durationSec ?? s.wordsCompleted * ESTIMATED_SECONDS_PER_WORD),
    0
  )
  return Math.round(seconds / 60)
}

/**
 * Total study time in minutes for the "Czas nauki" figure.
 *
 * Prefers the daily-time ledger, which is ticked live every 30 s — so it counts
 * time spent in sessions the user never finished, and it matches the daily ring
 * on Dzisiaj (which reads the same ledger). `studiedMinutes()` alone only sees
 * completed sessions, so it undercounts anyone who studies without finishing a
 * pack. Days from before the ledger existed (DB < v4) have no entry and fall
 * back to that day's session estimate.
 */
export function measuredStudyMinutes(dailyTime: DailyTime[], sessions: Session[]): number {
  const ledgerDays = new Set(dailyTime.map(d => d.date))
  const ledgerSec = dailyTime.reduce((sum, d) => sum + d.secondsStudied, 0)
  const preLedgerSec = sessions
    .filter(s => !ledgerDays.has(s.date))
    .reduce((sum, s) => sum + (s.durationSec ?? s.wordsCompleted * ESTIMATED_SECONDS_PER_WORD), 0)
  return Math.round((ledgerSec + preLedgerSec) / 60)
}

export interface LevelStats {
  avgWordsPerDay: number
  nextLevel: number | 'MASTER' | null
  nextLevelWords: number | null
  levelPct: number
  daysToNextLevel: number | null
}

export function useStats() {
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [bestDayCount, setBestDayCount] = useState(0)
  const [knownWords, setKnownWords] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [startedPacks, setStartedPacks] = useState(0)
  const [masteredPacks, setMasteredPacks] = useState(0)
  const [totalWordsHeard, setTotalWordsHeard] = useState(0)
  const [estimatedMinutes, setEstimatedMinutes] = useState(0)
  const [dueCount, setDueCount] = useState(0)
  const [servingLeft, setServingLeft] = useState(0)
  const [staleCount, setStaleCount] = useState(0)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [activity, setActivity] = useState<DayActivity[]>([])
  const [levelStats, setLevelStats] = useState<LevelStats | null>(null)
  const [paceTrend, setPaceTrend] = useState<PaceTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    async function load() {
      try {
        const snap = await loadProgressSnapshot(tick > 0)
        const { sessions, packageProgress, knownTotal } = snap

        setStreak(snap.streak)
        const [longest, bestDay] = await Promise.all([getLongestStreak(), getBestDayWordCount()])
        setLongestStreak(longest)
        setBestDayCount(bestDay)
        setKnownWords(knownTotal)
        setDueCount(snap.dueCount)
        setServingLeft(snap.servingLeft)
        setStaleCount(snap.staleCount)
        setReviewTotal(snap.reviewTotal)
        setSessionCount(sessions.length)
        setStartedPacks(packageProgress.length)
        setMasteredPacks(packageProgress.filter(p => p.masteredAt != null).length)

        // "Odsłuchane" means words heard via Słuchaj — sessions run in the
        // other mode (fiszki/Trenuj) don't count, even though they also
        // complete words.
        const heard = sessions
          .filter(s => s.mode === 'autoplay')
          .reduce((sum, s) => sum + s.wordsCompleted, 0)
        setTotalWordsHeard(heard)
        setEstimatedMinutes(studiedMinutes(sessions))

        // Build activity for the last ACTIVITY_DAYS local-calendar days. Both
        // the keys here and session.date come from dayKey(), so they compare
        // directly — mixing UTC and local day math is what used to shift this
        // window by a day outside UTC.
        const today = dayKey()
        const days: DayActivity[] = []
        for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
          const dateStr = shiftDay(-i, today)
          const count = sessions
            .filter(s => s.date === dateStr)
            .reduce((sum, s) => sum + s.wordsCompleted, 0)
          days.push({ date: dateStr, count })
        }
        setActivity(days)

        const avg = avgWordsPerDay(snap)
        setPaceTrend(avgWordsPerDayTrend(snap))
        const next = nextLevelFromTotalKnown(knownTotal)
        setLevelStats({
          avgWordsPerDay: avg,
          nextLevel: next?.level ?? null,
          nextLevelWords: next?.wordsToNext ?? null,
          levelPct: next?.pct ?? 100,
          daysToNextLevel: next
            ? (avg > 0 ? Math.ceil(next.wordsToNext / avg) : 0)
            : null,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tick])

  // Share of the route that isn't *neglected* — only words overdue past the
  // grace window (and never ones below the user's starting level) count against
  // it, so a big but freshly-scheduled backlog doesn't read as a stale route.
  // 100 % when nothing has been scheduled yet.
  const freshnessPct = knownWords > 0
    ? Math.round(((knownWords - Math.min(staleCount, knownWords)) / knownWords) * 100)
    : 100

  return { streak, longestStreak, bestDayCount, knownWords, sessionCount, startedPacks, masteredPacks, totalWordsHeard, estimatedMinutes, dueCount, servingLeft, staleCount, reviewTotal, freshnessPct, activity, levelStats, paceTrend, loading, reload, tick }
}
