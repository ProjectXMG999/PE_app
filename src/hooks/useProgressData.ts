import { useEffect, useState } from 'react'
import {
  getAllPackageProgress,
  getAllSessions,
  getAllWordProgress,
  getStreak,
} from '../services/db'
import { subscribeProgress } from '../services/progressEvents'
import { useAppStore } from '../store/useAppStore'
import { PackageProgress, Session, WordProgress } from '../types/progress'
import { dayKey, daysBetween, shiftDay } from '../utils/day'

export interface ProgressSnapshot {
  packageProgress: PackageProgress[]
  progressMap: Map<string, PackageProgress>
  wordProgress: WordProgress[]
  /** packageId → count of words with status 'known' */
  knownMap: Map<string, number>
  knownTotal: number
  /** Mastered words whose scheduled review date has arrived. */
  dueCount: number
  /** Sum of every word's reviewCount — how much has been actively maintained. */
  reviewTotal: number
  sessions: Session[]
  streak: number
}

async function fetchSnapshot(): Promise<ProgressSnapshot> {
  // Freezes live in the persisted UI store rather than IndexedDB — they're a
  // small entitlement, not study history — so the streak has to be told about
  // them here rather than being derivable from sessions alone.
  const frozenDays = useAppStore.getState().streakFreeze.usedOn

  const [packageProgress, wordProgress, sessions, streak] = await Promise.all([
    getAllPackageProgress(),
    getAllWordProgress(),
    getAllSessions(),
    getStreak(frozenDays),
  ])

  const today = dayKey()
  const knownMap = new Map<string, number>()
  let knownTotal = 0
  let dueCount = 0
  let reviewTotal = 0
  for (const wp of wordProgress) {
    if (wp.status === 'known') {
      knownMap.set(wp.packageId, (knownMap.get(wp.packageId) ?? 0) + 1)
      knownTotal++
    }
    if (wp.nextReviewAt != null && wp.nextReviewAt <= today) dueCount++
    reviewTotal += wp.reviewCount ?? 0
  }

  return {
    packageProgress,
    progressMap: new Map(packageProgress.map(p => [p.packageId, p])),
    wordProgress,
    knownMap,
    knownTotal,
    dueCount,
    reviewTotal,
    sessions,
    streak,
  }
}

// Deduplicates the burst of identical IndexedDB reads fired by the several
// components that mount together on a tab (Home renders 4 independent
// consumers). Long-lived caching is deliberately avoided: study pages write
// progress outside this module, so each fresh mount re-reads. Writes now also
// invalidate explicitly via progressEvents, which is what lets the always-
// mounted streak/points widget cache for much longer than this window.
let inflight: Promise<ProgressSnapshot> | null = null
let inflightAt = 0
const DEDUPE_MS = 2000

export function loadProgressSnapshot(force = false): Promise<ProgressSnapshot> {
  const now = Date.now()
  if (!force && inflight && now - inflightAt < DEDUPE_MS) return inflight
  inflightAt = now
  inflight = fetchSnapshot()
  return inflight
}

export function invalidateProgressSnapshot() {
  inflight = null
}

subscribeProgress(invalidateProgressSnapshot)

/** Returns null while loading. */
export function useProgressData(): ProgressSnapshot | null {
  const [data, setData] = useState<ProgressSnapshot | null>(null)
  useEffect(() => {
    let alive = true
    loadProgressSnapshot().then(d => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** Average known words learned per day across the session history. */
export function avgWordsPerDay(snapshot: ProgressSnapshot): number {
  const { sessions, knownTotal } = snapshot
  if (sessions.length === 0) return 0
  // getAllSessions() returns insertion order, not date order — find the
  // earliest/latest dates directly rather than assuming array position.
  let earliest = sessions[0].date
  let latest = sessions[0].date
  for (const s of sessions) {
    if (s.date < earliest) earliest = s.date
    if (s.date > latest) latest = s.date
  }
  const daysElapsed = Math.max(1, daysBetween(earliest, latest) + 1)
  return Math.round(knownTotal / daysElapsed)
}

export interface PaceTrend {
  current: number
  deltaPct: number | null
}

/**
 * Words-per-day pace for the last 7 days vs. the 7 days before that, so the
 * Stats page can show a trend arrow instead of a flat average. `deltaPct` is
 * null when there isn't a full prior window to compare against.
 */
export function avgWordsPerDayTrend(snapshot: ProgressSnapshot): PaceTrend {
  const { sessions } = snapshot
  const today = dayKey()

  function windowSum(startDaysAgo: number, endDaysAgo: number): number {
    const startStr = shiftDay(-startDaysAgo, today)
    const endStr = shiftDay(-endDaysAgo, today)
    return sessions
      .filter(s => s.date >= startStr && s.date <= endStr)
      .reduce((sum, s) => sum + s.wordsCompleted, 0)
  }

  const currentWindow = windowSum(6, 0)
  const priorWindow = windowSum(13, 7)
  const current = Math.round(currentWindow / 7)

  if (sessions.length === 0) return { current: 0, deltaPct: null }

  // getAllSessions() returns insertion order, not date order — find the
  // earliest date directly rather than assuming array position.
  const earliestDate = sessions.reduce((min, s) => (s.date < min ? s.date : min), sessions[0].date)
  const daysOfHistory = daysBetween(earliestDate, today) + 1
  if (daysOfHistory < 14 || priorWindow === 0) return { current, deltaPct: null }

  const deltaPct = Math.round(((currentWindow - priorWindow) / priorWindow) * 100)
  return { current, deltaPct }
}
