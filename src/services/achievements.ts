import { ACHIEVEMENTS, Achievement, AchievementMetric } from '../data/achievements'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { DailyTime, Session } from '../types/progress'
import { PackMeta } from '../types/vocabulary'
import { studiedMinutes } from '../hooks/useStats'
import { daysBetween, isWeekend, parseDay, dayKey } from '../utils/day'

/**
 * Achievement evaluation.
 *
 * Every badge is a threshold on one of the metrics computed below, all of which
 * are derived from data the app already stores. Nothing about a badge is
 * persisted except the date it was first earned — so this can be recomputed
 * freely, survives a cross-device merge, and clears itself on a progress reset.
 */

export type MetricValues = Record<AchievementMetric, number>

export interface AchievementState {
  achievement: Achievement
  /** Current value of the badge's metric. */
  value: number
  unlocked: boolean
  /** 0-100 toward the threshold. */
  pct: number
  /** ISO date first earned, if known. */
  unlockedAt?: string
  /** Earned but the celebration hasn't been shown yet. */
  isNew?: boolean
}

export interface AchievementInput {
  snapshot: ProgressSnapshot
  allPacks: PackMeta[]
  dailyTime: DailyTime[]
  longestStreak: number
  bestDayCount: number
}

function hourOf(s: Session): number | null {
  return s.startedAt ? new Date(s.startedAt).getHours() : null
}

/**
 * Consecutive weekends (counting back from the most recent one studied) in which
 * at least one session happened.
 */
function weekendRun(sessions: Session[]): number {
  const weekendDays = [...new Set(sessions.map(s => s.date))].filter(isWeekend).sort().reverse()
  if (weekendDays.length === 0) return 0

  // Collapse to one entry per weekend by anchoring on the Saturday.
  const weekends = new Set(
    weekendDays.map(d => {
      const date = parseDay(d)
      // Sunday (0) belongs to the Saturday before it.
      const anchor = date.getDay() === 0 ? -1 : 0
      const sat = new Date(date)
      sat.setDate(sat.getDate() + anchor)
      return dayKey(sat)
    })
  )

  const sorted = [...weekends].sort().reverse()
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i], sorted[i - 1]) === 7) run++
    else break
  }
  return run
}

/**
 * Consecutive days, ending today, on which the review serving was cleared.
 *
 * Read straight from the per-day `reviewLedger` (written live by fetchSnapshot
 * when the serving hits 0), so it's monotonic and honest — no more jumping from
 * 0 to 90 the way the old lastSeen estimate did. A day with no ledger row breaks
 * the run. Today not being cleared yet doesn't break it (the run is counted from
 * the most recent cleared day back).
 *
 * Returns 0 for a user who has never scheduled anything — no meaningful streak yet.
 */
function cleanDays(snapshot: ProgressSnapshot): number {
  if (!snapshot.wordProgress.some(w => w.nextReviewAt != null)) return 0

  const cleared = new Set(
    snapshot.reviewLedger.filter(e => e.cleared).map(e => e.date)
  )
  if (cleared.size === 0) return 0

  const today = dayKey()
  // Start from today if it's already cleared, else from yesterday (today may
  // still be in progress).
  let cursor = cleared.has(today) ? today : parseDayKey(today, -1)
  let run = 0
  while (cleared.has(cursor)) {
    run++
    cursor = parseDayKey(cursor, -1)
  }
  return run
}

function parseDayKey(key: string, offsetDays: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + offsetDays)
  return dayKey(d)
}

/** Counts groups (volumes / chapters) in which every pack is mastered. */
function fullyMasteredGroups(
  allPacks: PackMeta[],
  masteredIds: Set<string>,
  key: (p: PackMeta) => string
): number {
  const total = new Map<string, number>()
  const done = new Map<string, number>()
  for (const p of allPacks) {
    const k = key(p)
    total.set(k, (total.get(k) ?? 0) + 1)
    if (masteredIds.has(p.id)) done.set(k, (done.get(k) ?? 0) + 1)
  }
  let count = 0
  for (const [k, n] of total) {
    if ((done.get(k) ?? 0) === n) count++
  }
  return count
}

export function computeMetrics(input: AchievementInput): MetricValues {
  const { snapshot, allPacks, dailyTime, longestStreak, bestDayCount } = input
  const { sessions, packageProgress, knownTotal, reviewTotal, knownMap } = snapshot

  const masteredIds = new Set(packageProgress.filter(p => p.masteredAt != null).map(p => p.packageId))
  const startedIds = new Set(packageProgress.map(p => p.packageId))

  const startedCategories = new Set(
    allPacks.filter(p => startedIds.has(p.id)).map(p => p.category)
  )

  // A category counts as complete when every word in every one of its packs is
  // known — compared against the index's wordCount, not against pack mastery,
  // so it can't be satisfied by the "mark all known" shortcut alone.
  const catTotals = new Map<string, { known: number; total: number }>()
  for (const p of allPacks) {
    const entry = catTotals.get(p.category) ?? { known: 0, total: 0 }
    entry.total += p.wordCount
    entry.known += knownMap.get(p.id) ?? 0
    catTotals.set(p.category, entry)
  }
  const categoryComplete = [...catTotals.values()].filter(c => c.total > 0 && c.known >= c.total).length

  return {
    knownWords: knownTotal,
    streak: Math.max(snapshot.streak, longestStreak),
    wordsHeard: sessions.reduce((sum, s) => sum + s.wordsCompleted, 0),
    minutes: studiedMinutes(sessions),
    goalDays: dailyTime.filter(d => d.goalMetAt != null).length,
    reviews: reviewTotal,
    cleanDays: cleanDays(snapshot),
    masteredPacks: masteredIds.size,
    speakingSessions: sessions.filter(s => s.autoplayMode === 'speaking').length,
    earlySessions: sessions.filter(s => {
      const h = hourOf(s)
      return h != null && h < 8
    }).length,
    nightSessions: sessions.filter(s => {
      const h = hourOf(s)
      return h != null && h >= 22
    }).length,
    weekendRun: weekendRun(sessions),
    bestDay: bestDayCount,
    longestSession: sessions.reduce((max, s) => Math.max(max, s.wordsCompleted), 0),
    volumesDone: fullyMasteredGroups(allPacks, masteredIds, p => p.volume),
    chaptersDone: fullyMasteredGroups(allPacks, masteredIds, p => `${p.volume}|${p.chapter}`),
    categoriesStarted: startedCategories.size,
    categoryComplete,
  }
}

export function evaluateAchievements(
  input: AchievementInput,
  unlocks: Record<string, { at: string; seen: boolean }> = {}
): { states: AchievementState[]; metrics: MetricValues } {
  const metrics = computeMetrics(input)

  const states = ACHIEVEMENTS.map<AchievementState>(a => {
    const value = metrics[a.metric]
    const unlocked = value >= a.threshold
    const record = unlocks[a.id]
    return {
      achievement: a,
      value,
      unlocked,
      pct: a.threshold > 0 ? Math.min(100, Math.round((value / a.threshold) * 100)) : 0,
      unlockedAt: record?.at,
      isNew: unlocked && record != null && !record.seen,
    }
  })

  return { states, metrics }
}

/** Earned badges, most recently earned first. Undated ones sort last. */
export function recentlyUnlocked(states: AchievementState[], limit = 4): AchievementState[] {
  return states
    .filter(s => s.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, limit)
}

/**
 * Locked badges closest to being earned — the strongest motivator on the page,
 * because "79/100" is a far more specific nudge than a wall of trophies.
 * Badges at 0 % are skipped: "you have 0 of 365 days" isn't within reach.
 */
export function closestToUnlock(states: AchievementState[], limit = 3): AchievementState[] {
  return states
    .filter(s => !s.unlocked && s.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
}
