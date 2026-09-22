import { Session } from '../types/progress'
import { ProgressSnapshot, declaredMasteredPackIds } from '../hooks/useProgressData'

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
 *
 * v3: FSRS scheduler (reviewCount accrues at a different rate long-term;
 * retirement is now a stability threshold, not a rep count).
 *
 * v4: "declared, not effort" exclusion. Words known/retired purely by a bulk
 * declaration (per-pack "Znam wszystko" — retroactively — or "Oznacz cały
 * poziom jako opanowany") no longer earn the known-word or retirement bonus,
 * and a pack mastered entirely by declaration no longer earns the pack
 * bonus. A deliberate, accepted retroactive correction for existing bulk-mark
 * users, not just new declarations — see services/review.ts `isDeclaredKnownWord`.
 *
 * `assertedKnownAt` is deliberately NOT treated the same way. A first-exposure
 * "Znam" also asserts prior knowledge, but the learner faced that specific word
 * and answered it, which is the thing points are for. It suppresses a claim
 * about memory STRENGTH (the retention chart), not a claim about effort.
 *
 * v5: the pack bonus follows the listen axis. `perCompletedPack` was keyed on
 * `completedAt`, which a Trenuj run stamps — so finishing a pack in training
 * paid a "listened through" bonus on top of the per-word session weights
 * already earned for that same work, and a level declaration paid it for work
 * never done at all. It is now `perListenedPack`, keyed on `listenedAt`, which
 * only a real Słuchaj play-through sets (see services/listenAxis.ts); working
 * a pack through in any other mode earns its session points and nothing extra.
 * Conversely the declared-pack exclusion no longer swallows the listen bonus:
 * the axes are independent, so a declared pack you did genuinely listen to
 * keeps what it earned. Retroactive, like v4 — this affects everyone who
 * trained packs to the end, not only those who declared a level.
 */
export const RULES_VERSION = 5

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
  // Inteligentny mixes learn + review + stretch in one run — weighted like a
  // review session since protecting/extending the route is most of what it does.
  'fiszki:smart': 2.5,
} as const

export const POINTS = {
  /** A word moved to 'known'. */
  perKnownWord: 5,
  /** A word held onto through a successful review. */
  perReview: 3,
  /** A word graduated out of the review queue for good (~5 reviews over 6 months). */
  perRetiredWord: 30,
  /** A pack with every word mastered. */
  perMasteredPack: 50,
  /** A pack genuinely listened through end to end in Słuchaj. */
  perListenedPack: 25,
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
  if (s.trainMode === 'smart') return SESSION_WEIGHTS['fiszki:smart']
  return SESSION_WEIGHTS['fiszki']
}

export interface PointsBreakdown {
  sessions: number
  known: number
  reviews: number
  retired: number
  packs: number
  streak: number
  goals: number
}

export interface PointsResult {
  total: number
  breakdown: PointsBreakdown
}

/**
 * ── RULES_VERSION 2 ─────────────────────────────────────────────────────────
 * Two changes ship together: a one-time `perRetiredWord` bonus, and — via
 * review.ts — `reviewCount` now caps at RETIRE_AT_REVIEW_COUNT instead of
 * climbing forever. For almost everyone that's a net gain (the bonus); a
 * handful of multi-year users may see `reviewTotal` and thus points dip a
 * little. RULES_VERSION exists precisely for this; nothing is stored, so the
 * total simply re-derives.
 *
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
  const known = (snapshot.knownTotal - snapshot.declaredKnownTotal) * POINTS.perKnownWord
  const reviews = snapshot.reviewTotal * POINTS.perReview
  const retired = (snapshot.retiredCount - snapshot.declaredRetiredCount) * POINTS.perRetiredWord

  // Two independent bonuses, so a pack can earn both: mastery is knowledge,
  // listening is time spent with the audio. The declared-pack exclusion applies
  // only to the mastery half — a declaration says nothing about listening, and
  // a pack you declared AND played through earned that half honestly.
  const declaredPackIds = declaredMasteredPackIds(snapshot)
  let mastered = 0
  let listened = 0
  for (const p of snapshot.packageProgress) {
    if (p.masteredAt != null && !declaredPackIds.has(p.packageId)) mastered++
    if (p.listenedAt != null) listened++
  }
  const packs = mastered * POINTS.perMasteredPack + listened * POINTS.perListenedPack

  const streak = longestStreak * POINTS.perLongestStreakDay
  const goals = goalDays * POINTS.perGoalDay

  const breakdown: PointsBreakdown = { sessions, known, reviews, retired, packs, streak, goals }
  const total = sessions + known + reviews + retired + packs + streak + goals

  return { total, breakdown }
}

/** 18430 → "18 430". Narrow no-break spaces, Polish convention. */
export function formatPoints(n: number): string {
  return n.toLocaleString('pl-PL').replace(/ /g, ' ')
}
