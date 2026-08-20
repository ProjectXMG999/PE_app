import { useEffect, useState } from 'react'
import {
  getAllPackageProgress,
  getAllSessions,
  getAllWordProgress,
  getStreak,
} from '../services/db'
import { PackageProgress, Session, WordProgress } from '../types/progress'

export interface ProgressSnapshot {
  packageProgress: PackageProgress[]
  progressMap: Map<string, PackageProgress>
  wordProgress: WordProgress[]
  /** packageId → count of words with status 'known' */
  knownMap: Map<string, number>
  knownTotal: number
  sessions: Session[]
  streak: number
}

async function fetchSnapshot(): Promise<ProgressSnapshot> {
  const [packageProgress, wordProgress, sessions, streak] = await Promise.all([
    getAllPackageProgress(),
    getAllWordProgress(),
    getAllSessions(),
    getStreak(),
  ])
  const knownMap = new Map<string, number>()
  let knownTotal = 0
  for (const wp of wordProgress) {
    if (wp.status === 'known') {
      knownMap.set(wp.packageId, (knownMap.get(wp.packageId) ?? 0) + 1)
      knownTotal++
    }
  }
  return {
    packageProgress,
    progressMap: new Map(packageProgress.map(p => [p.packageId, p])),
    wordProgress,
    knownMap,
    knownTotal,
    sessions,
    streak,
  }
}

// Deduplicates the burst of identical IndexedDB reads fired by the several
// components that mount together on a tab (Home renders 4 independent
// consumers). Long-lived caching is deliberately avoided: study pages write
// progress outside this module, so each fresh mount re-reads.
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
  const first = sessions[sessions.length - 1]
  const last = sessions[0]
  const daysElapsed = Math.max(
    1,
    Math.floor((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000) + 1
  )
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function windowSum(startDaysAgo: number, endDaysAgo: number): number {
    const start = new Date(today)
    start.setDate(start.getDate() - startDaysAgo)
    const startStr = start.toISOString().split('T')[0]
    const end = new Date(today)
    end.setDate(end.getDate() - endDaysAgo)
    const endStr = end.toISOString().split('T')[0]
    return sessions
      .filter(s => s.date >= startStr && s.date <= endStr)
      .reduce((sum, s) => sum + s.wordsCompleted, 0)
  }

  const currentWindow = windowSum(6, 0)
  const priorWindow = windowSum(13, 7)
  const current = Math.round(currentWindow / 7)

  if (sessions.length === 0) return { current: 0, deltaPct: null }

  const earliestDate = sessions[sessions.length - 1].date
  const daysOfHistory = Math.floor((today.getTime() - new Date(earliestDate).getTime()) / 86400000) + 1
  if (daysOfHistory < 14 || priorWindow === 0) return { current, deltaPct: null }

  const deltaPct = Math.round(((currentWindow - priorWindow) / priorWindow) * 100)
  return { current, deltaPct }
}
