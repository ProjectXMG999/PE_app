import { Session } from '../types/progress'
import { ProgressSnapshot } from '../hooks/useProgressData'

/**
 * Punkty Progress (⬥) — the effort currency.
 *
 * Words-known is the app's headline number, but it only measures *outcome*: it
 * moves when something finally sticks, and stays flat on the days a user listens
 * for half an hour and nothing clicks. Points measure the work itself, so those
 * days still visibly count for something.
 *
 * ── Derived, not banked ──────────────────────────────────────────────────────
 * `computePoints` is a pure function of the progress snapshot, recomputed on
 * every read. Nothing is stored. That buys three things: no new sync surface, a
 * total that self-heals after a cross-device merge, and a reset that can't leave
 * an orphaned balance behind. The trade is that changing the weights below
 * retroactively changes everyone's total — so treat RULES_VERSION as a contract
 * and bump it whenever the numbers move.
 */
export const RULES_VERSION = 1

/**
 * Per-word multiplier by how the session was run. Speaking and active training
 * are worth the most because they're what the method actually claims to build —
 * retrieval and production, not recognition.
 */
const SESSION_WEIGHTS = {
  'autoplay:fast': 1,
  'autoplay:standard': 1.5,
  'autoplay:speaking': 2,
  'fiszki': 2,
  'fiszki:review': 2.5,
} as const

export const POINTS = {
  /** A word moved to 'known'. */
  perKnownWord: 5,
  /** A word held onto through a successful review. */
  perReview: 3,
  /** A pack with every word mastered. */
  perMasteredPack: 50,
  /** A pack listened through end to end. */
  perCompletedPack: 25,
  /** Personal-best streak, rewarded once rather than per day. */
  perLongestStreakDay: 10,
  /** Each day the study-time goal was met. */
  perGoalDay: 20,
} as const

function weightFor(s: Session): number {
  if (s.mode === 'autoplay') {
    const key = `autoplay:${s.autoplayMode ?? 'standard'}` as keyof typeof SESSION_WEIGHTS
    return SESSION_WEIGHTS[key] ?? SESSION_WEIGHTS['autoplay:standard']
  }
  if (s.trainMode === 'review') return SESSION_WEIGHTS['fiszki:review']
  return SESSION_WEIGHTS['fiszki']
}

export interface PointsBreakdown {
  sessions: number
  known: number
  reviews: number
  packs: number
  streak: number
  goals: number
}

export interface PointsResult {
  total: number
  breakdown: PointsBreakdown
}

/**
 * @param goalDays how many days the daily time goal was met — comes from the
 *        dailyTime store, which isn't part of the progress snapshot.
 */
export function computePoints(
  snapshot: ProgressSnapshot,
  options: { longestStreak?: number; goalDays?: number } = {}
): PointsResult {
  const { longestStreak = 0, goalDays = 0 } = options

  const sessions = Math.round(
    snapshot.sessions.reduce((sum, s) => sum + s.wordsCompleted * weightFor(s), 0)
  )
  const known = snapshot.knownTotal * POINTS.perKnownWord
  const reviews = snapshot.reviewTotal * POINTS.perReview

  let mastered = 0
  let completed = 0
  for (const p of snapshot.packageProgress) {
    if (p.masteredAt != null) mastered++
    else if (p.completedAt != null) completed++
  }
  const packs = mastered * POINTS.perMasteredPack + completed * POINTS.perCompletedPack

  const streak = longestStreak * POINTS.perLongestStreakDay
  const goals = goalDays * POINTS.perGoalDay

  const breakdown: PointsBreakdown = { sessions, known, reviews, packs, streak, goals }
  const total = sessions + known + reviews + packs + streak + goals

  return { total, breakdown }
}

/** 18430 → "18 430". Narrow no-break spaces, Polish convention. */
export function formatPoints(n: number): string {
  return n.toLocaleString('pl-PL').replace(/ /g, ' ')
}
