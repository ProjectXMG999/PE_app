import { useEffect, useState } from 'react'
import {
  getAllPackageProgress,
  getAllReviewLedger,
  getAllSessions,
  getAllWordProgress,
  getStreak,
  saveReviewLedger,
} from '../services/db'
import { subscribeProgress } from '../services/progressEvents'
import {
  computeServingState,
  reviewUrgency,
  staleWordCount,
  PriorityCtx,
  ReviewUrgency,
} from '../services/reviewQueue'
import { useAppStore } from '../store/useAppStore'
import { PackageProgress, ReviewLedgerEntry, Session, WordProgress } from '../types/progress'
import { PackMeta } from '../types/vocabulary'
import packagesIndex from '../data/packages-index.json'
import { dayKey, daysBetween, shiftDay } from '../utils/day'

/** packageId → difficulty tier, built once. Feeds the priority/neglect maths. */
const PACK_LEVEL = new Map<string, number>(
  (packagesIndex as PackMeta[]).map(p => [p.id, p.level])
)
export const packLevelOf = (id: string): number => PACK_LEVEL.get(id) ?? 1

export interface ProgressSnapshot {
  packageProgress: PackageProgress[]
  progressMap: Map<string, PackageProgress>
  wordProgress: WordProgress[]
  /** packageId → count of words with status 'known' */
  knownMap: Map<string, number>
  knownTotal: number
  /** Known words that came from "oznacz całą paczkę jako znaną" rather than
   *  actual study — identified as packs mastered with zero sessions to their
   *  name (the bulk-mark writes no session; every other route to masteredAt
   *  does). Subtracted from the learning-pace average so catching the app up to
   *  knowledge you already had doesn't inflate "słów / dzień". Deliberately NOT
   *  subtracted from knownTotal — those words are genuinely known. */
  bulkKnownTotal: number
  /** Raw backlog: due, non-retired words whose review date has arrived. */
  dueCount: number
  /** The due words themselves — kept so scoring/urgency need no second read. */
  dueWords: WordProgress[]
  /** How many of today's review budget are still unshown. */
  servingLeft: number
  /** Today's review budget (scaled from goal + vocabulary). */
  reviewBudget: number
  /** Reviews already done today through /powtorka. */
  served: number
  /** Words graduated out of the active queue. */
  retiredCount: number
  /** Due words neglected past the grace window (excl. below-level) — feeds freshness. */
  staleCount: number
  /** calm / building / urgent — drives the indicator on the "Powtórka" element. */
  reviewUrgency: ReviewUrgency
  /** Sum of every word's reviewCount — how much has been actively maintained. */
  reviewTotal: number
  /** Per-day "was the serving cleared" log — feeds the clean-streak achievement. */
  reviewLedger: ReviewLedgerEntry[]
  sessions: Session[]
  streak: number
}

async function fetchSnapshot(): Promise<ProgressSnapshot> {
  // Freezes live in the persisted UI store rather than IndexedDB — they're a
  // small entitlement, not study history — so the streak has to be told about
  // them here rather than being derivable from sessions alone.
  const { streakFreeze, dailyGoalSec, todayLevel } = useAppStore.getState()

  const [packageProgress, wordProgress, sessions, ledger, streak] = await Promise.all([
    getAllPackageProgress(),
    getAllWordProgress(),
    getAllSessions(),
    getAllReviewLedger(),
    getStreak(streakFreeze.usedOn),
  ])

  const today = dayKey()
  const knownMap = new Map<string, number>()
  let knownTotal = 0
  let reviewTotal = 0
  let retiredCount = 0
  const dueWords: WordProgress[] = []
  for (const wp of wordProgress) {
    if (wp.status === 'known') {
      knownMap.set(wp.packageId, (knownMap.get(wp.packageId) ?? 0) + 1)
      knownTotal++
    }
    if (wp.retiredAt != null) retiredCount++
    else if (wp.nextReviewAt != null && wp.nextReviewAt <= today) dueWords.push(wp)
    reviewTotal += wp.reviewCount ?? 0
  }

  // A pack whose masteredAt is set but which has no session attributed to it
  // was marked known in bulk from the pack preview — count its known words so
  // the pace average can leave them out. Review sessions use the '__review__'
  // marker, never a real packageId, so reviewing bulk-known words later doesn't
  // spuriously reclassify the pack as studied.
  const studiedPackIds = new Set(sessions.map(s => s.packageId))
  let bulkKnownTotal = 0
  for (const p of packageProgress) {
    if (p.masteredAt != null && !studiedPackIds.has(p.packageId)) {
      bulkKnownTotal += knownMap.get(p.packageId) ?? 0
    }
  }

  const serving = computeServingState({
    due: dueWords,
    wordProgress,
    goalSec: dailyGoalSec,
    recentPace: sevenDayPace(sessions, today),
    knownTotal,
    today,
  })
  const priorityCtx: PriorityCtx = { today, todayLevel, packLevelOf }

  // Record today as "cleared" once the serving is done (nothing due, or the
  // budget is spent). Write once per day; the emitted event re-fetches, which
  // then finds the row and skips. Keeps cleanDays a faithful, monotonic streak.
  let reviewLedger = ledger
  if (serving.done && !ledger.some(e => e.date === today && e.cleared)) {
    const entry: ReviewLedgerEntry = { date: today, cleared: true, clearedAt: new Date().toISOString() }
    reviewLedger = [...ledger.filter(e => e.date !== today), entry]
    void saveReviewLedger(entry)
  }

  return {
    packageProgress,
    progressMap: new Map(packageProgress.map(p => [p.packageId, p])),
    wordProgress,
    knownMap,
    knownTotal,
    bulkKnownTotal,
    dueCount: serving.backlog,
    dueWords,
    servingLeft: serving.remaining,
    reviewBudget: serving.budget,
    served: serving.served,
    retiredCount,
    staleCount: staleWordCount(dueWords, priorityCtx),
    reviewUrgency: reviewUrgency({ state: serving, due: dueWords, today }),
    reviewTotal,
    reviewLedger,
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

/**
 * Average known words learned per day across the session history.
 *
 * Words the user bulk-marked as known (a pack "opanowana" without ever studying
 * it) are excluded from the numerator — that's someone syncing the app to
 * vocabulary they already had, not learning done at this pace. They still count
 * in knownTotal and toward levels; only the *rate* leaves them out.
 */
export function avgWordsPerDay(snapshot: ProgressSnapshot): number {
  const { sessions, knownTotal, bulkKnownTotal } = snapshot
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
  const studyLearned = Math.max(0, knownTotal - bulkKnownTotal)
  return Math.round(studyLearned / daysElapsed)
}

export interface PaceTrend {
  current: number
  deltaPct: number | null
}

/** Words completed per day over the last 7 days. Feeds the review budget
 *  (reviewQueue.computeReviewBudget) and the Stats trend. */
export function sevenDayPace(sessions: Session[], today: string = dayKey()): number {
  const startStr = shiftDay(-6, today)
  const sum = sessions
    .filter(s => s.date >= startStr && s.date <= today)
    .reduce((acc, s) => acc + s.wordsCompleted, 0)
  return Math.round(sum / 7)
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
  const current = sevenDayPace(sessions, today)

  if (sessions.length === 0) return { current: 0, deltaPct: null }

  // getAllSessions() returns insertion order, not date order — find the
  // earliest date directly rather than assuming array position.
  const earliestDate = sessions.reduce((min, s) => (s.date < min ? s.date : min), sessions[0].date)
  const daysOfHistory = daysBetween(earliestDate, today) + 1
  if (daysOfHistory < 14 || priorWindow === 0) return { current, deltaPct: null }

  const deltaPct = Math.round(((currentWindow - priorWindow) / priorWindow) * 100)
  return { current, deltaPct }
}
