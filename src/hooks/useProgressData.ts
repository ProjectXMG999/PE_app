import { useEffect, useState } from 'react'
import {
  getAllDailyTime,
  getAllPackageProgress,
  getAllReviewLedger,
  getAllSessions,
  getAllWordProgress,
  getStreak,
  saveReviewLedger,
} from '../services/db'
import { subscribeProgress } from '../services/progressEvents'
import { isDeclaredKnownWord, isDeclaredRetiredWord } from '../services/review'
import {
  activeDayMinutes,
  computeServingState,
  maintenanceLoad,
  reviewSecPerCard,
  reviewUrgency,
  staleWordCount,
  MaintenanceLoad,
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

/** packageId → how many words the pack actually holds today. The catalogue is
 *  the authority on what exists; word progress is only a claim about it. */
const PACK_WORDS = new Map<string, number>(
  (packagesIndex as PackMeta[]).map(p => [p.id, p.wordCount])
)

export interface ProgressSnapshot {
  packageProgress: PackageProgress[]
  progressMap: Map<string, PackageProgress>
  wordProgress: WordProgress[]
  /** packageId → count of words with status 'known' */
  knownMap: Map<string, number>
  knownTotal: number
  /** Known words that are 'known' purely by a bulk declaration — per-pack
   *  "Znam wszystko" or a level-mastery mark (services/levelMastery.ts) —
   *  rather than real study. Exact, per-word (see services/review.ts
   *  `isDeclaredKnownWord`), unlike the pack-level heuristic this replaced
   *  (a pack studied for real and later topped up with declared words used to
   *  slip through undetected). Subtracted from pace, points and achievements;
   *  still counted in knownTotal and toward levels — those words are
   *  genuinely known, just not genuinely studied. */
  declaredKnownTotal: number
  /** packageId → declared-known count, the per-pack breakdown of the above. */
  declaredKnownMap: Map<string, number>
  /** Raw backlog: due, non-retired words whose review date has arrived. */
  dueCount: number
  /** The due words themselves — kept so scoring/urgency need no second read. */
  dueWords: WordProgress[]
  /** How many of today's review budget are still unshown. */
  servingLeft: number
  /** Today's review budget (goal as ceiling, study time as check, backlog as floor). */
  reviewBudget: number
  /** Seconds one review card takes this learner — measured from their own
   *  review sessions. Sizes the budget AND every "ok. N min" next to a review
   *  count, so the two can't disagree. See reviewQueue.reviewSecPerCard. */
  reviewSecPerCard: number
  /** Reviews already done today through /powtorka. */
  served: number
  /** Reviews per day the learner's own vocabulary generates, vs. what the
   *  budget covers. The inflow the serving is trying to keep up with. */
  maintenanceLoad: MaintenanceLoad
  /** Words graduated out of the active queue. */
  retiredCount: number
  /** Of retiredCount, how many were forced by a level-mastery declaration
   *  rather than earned via durable FSRS stability — excluded from the
   *  retirement point bonus. */
  declaredRetiredCount: number
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

  const [packageProgress, storedWordProgress, sessions, ledger, dailyTime, streak] = await Promise.all([
    getAllPackageProgress(),
    getAllWordProgress(),
    getAllSessions(),
    getAllReviewLedger(),
    getAllDailyTime(),
    getStreak(streakFreeze.usedOn),
  ])

  // Progress rows outlive the catalogue. Past data passes consolidated packs
  // and deduped words (see the `packs/` deletions in git history), and every
  // row the learner had earned in a pack that no longer exists stayed behind in
  // IndexedDB. Counted, they pushed "słów poznanych" past the corpus itself —
  // 10 948 known out of 10 935 that exist, with every territory bar at exactly
  // full, because the bars read the catalogue and the counter didn't. A word
  // that isn't on the route any more isn't a word you know here.
  const wordProgress = storedWordProgress.filter(wp => PACK_WORDS.has(wp.packageId))

  const today = dayKey()
  const knownMap = new Map<string, number>()
  const declaredKnownMap = new Map<string, number>()
  let reviewTotal = 0
  let retiredCount = 0
  let declaredRetiredCount = 0
  const dueWords: WordProgress[] = []
  for (const wp of wordProgress) {
    if (wp.status === 'known') {
      knownMap.set(wp.packageId, (knownMap.get(wp.packageId) ?? 0) + 1)
      if (isDeclaredKnownWord(wp)) {
        declaredKnownMap.set(wp.packageId, (declaredKnownMap.get(wp.packageId) ?? 0) + 1)
      }
    }
    if (wp.retiredAt != null) {
      retiredCount++
      if (isDeclaredRetiredWord(wp)) declaredRetiredCount++
    }
    // Being retired is not what keeps a word out of the queue — having no date
    // is. A declaration clears nextReviewAt for good (levelMastery.ts), so those
    // words never come back, which is exactly what the learner asked for. An
    // EARNED retirement deliberately keeps a real ~yearly date (review.ts), and
    // that check-in is the whole point of deep maintenance. The `else` here
    // swallowed it, which quietly made "Na stałe · raz w roku" a promise nothing
    // kept, and left W_DEEP_MAINT scoring a case that could never arise.
    if (wp.nextReviewAt != null && wp.nextReviewAt <= today) dueWords.push(wp)
    reviewTotal += wp.reviewCount ?? 0
  }

  // The same rule one level finer. A word dropped from a pack that still
  // exists leaves a row the filter above can't catch — its packageId is still
  // real — so cap each pack at its own size: no pack can hold more known words
  // than it holds words. Declared-known is capped under that, since it's a
  // subset of it and feeds the "oznaczyłeś bez nauki" line.
  let knownTotal = 0
  let declaredKnownTotal = 0
  for (const [packageId, rawKnown] of knownMap) {
    const known = Math.min(rawKnown, PACK_WORDS.get(packageId) ?? 0)
    knownMap.set(packageId, known)
    knownTotal += known
    const declared = Math.min(declaredKnownMap.get(packageId) ?? 0, known)
    if (declared > 0) declaredKnownMap.set(packageId, declared)
    else declaredKnownMap.delete(packageId)
    declaredKnownTotal += declared
  }

  const secPerCard = reviewSecPerCard(sessions, today)
  const serving = computeServingState({
    due: dueWords,
    wordProgress,
    goalSec: dailyGoalSec,
    secPerCard,
    // Study TIME, not words completed. A review session records exactly as many
    // words as the budget allowed, so deriving the budget from that number made
    // it measure itself — see the note in reviewConfig.ts. `activeDayMinutes`
    // returns null when there's no qualifying study day at all, which is a
    // different statement from "they studied zero minutes" and must not hold
    // the budget down to its floor.
    activeMinutes: activeDayMinutes(dailyTime, today),
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
    declaredKnownTotal,
    declaredKnownMap,
    dueCount: serving.backlog,
    dueWords,
    servingLeft: serving.remaining,
    reviewBudget: serving.budget,
    reviewSecPerCard: secPerCard,
    served: serving.served,
    maintenanceLoad: maintenanceLoad(wordProgress, serving.budget, secPerCard),
    retiredCount,
    declaredRetiredCount,
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

/**
 * Returns null while loading.
 *
 * `refreshKey` is an escape hatch for a page that mutates progress itself and
 * needs its own numbers to update without a remount — e.g. HomePage bumping a
 * counter after "Oznacz poziom jako opanowany" so the level bar and X/10 000
 * move right away. Every other call site omits it: `undefined` never changes
 * across renders, so the effect's dependency array behaves exactly like the
 * old `[]` and existing consumers are unaffected. Passing it forces a fresh
 * read (bypassing the dedupe window) rather than relying on the global cache
 * invalidation other writers already trigger via progressEvents.
 */
export function useProgressData(refreshKey?: unknown): ProgressSnapshot | null {
  const [data, setData] = useState<ProgressSnapshot | null>(null)
  useEffect(() => {
    let alive = true
    loadProgressSnapshot(refreshKey !== undefined).then(d => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [refreshKey])
  return data
}

/**
 * Average known words learned per day across the session history.
 *
 * Words the user declared known in bulk (a pack "opanowana" without ever
 * studying it, or a whole level via "Oznacz jako opanowany") are excluded
 * from the numerator — that's someone syncing the app to vocabulary they
 * already had, not learning done at this pace. They still count in
 * knownTotal and toward levels; only the *rate* leaves them out.
 */
export function avgWordsPerDay(snapshot: ProgressSnapshot): number {
  const { sessions, knownTotal, declaredKnownTotal } = snapshot
  if (sessions.length === 0) return 0
  // getAllSessions() returns insertion order, not date order — find the
  // earliest date directly rather than assuming array position.
  let earliest = sessions[0].date
  for (const s of sessions) {
    if (s.date < earliest) earliest = s.date
  }
  // Measured to TODAY, not to the last session. Ending the window at the last
  // session froze the pace the moment someone stopped studying, so "przy tym
  // tempie jesteś 91 dni od Survival English" stayed true however long the app
  // went unopened. A pace that can't fall isn't a pace.
  const daysElapsed = Math.max(1, daysBetween(earliest, dayKey()) + 1)
  const studyLearned = Math.max(0, knownTotal - declaredKnownTotal)
  return Math.round(studyLearned / daysElapsed)
}

/** Packs whose mastery came ENTIRELY from a bulk declaration — every known
 *  word in the pack is declared, none earned. Used to zero out the per-pack
 *  point/achievement bonus for a pack nobody actually studied. A pack with a
 *  MIX of real and declared words still counts toward that bonus — dividing
 *  it proportionally was judged unnecessary complexity for how rarely a pack
 *  straddles the two. */
export function declaredMasteredPackIds(snapshot: ProgressSnapshot): Set<string> {
  const out = new Set<string>()
  for (const p of snapshot.packageProgress) {
    if (p.masteredAt == null) continue
    const known = snapshot.knownMap.get(p.packageId) ?? 0
    const declared = snapshot.declaredKnownMap.get(p.packageId) ?? 0
    if (known > 0 && declared === known) out.add(p.packageId)
  }
  return out
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
 * The pace figure shown on Postęp, plus a trend arrow.
 *
 * `current` is `avgWordsPerDay` — words actually LEARNED per day — and not the
 * seven-day throughput it used to be. The two are different measures (throughput
 * counts every card completed, including repeats of words you already knew), and
 * showing one in the "tempo" tile while the sentence right underneath it —
 * "przy tym tempie jesteś N dni od…" — was computed from the other is how the
 * page came to disagree with itself.
 *
 * `deltaPct` still compares seven-day throughput against the prior seven days:
 * as a *direction* that's the responsive signal, and it's never rendered as a
 * number of words. Null when there isn't a full prior window to compare against.
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
  const current = avgWordsPerDay(snapshot)

  if (sessions.length === 0) return { current: 0, deltaPct: null }

  // getAllSessions() returns insertion order, not date order — find the
  // earliest date directly rather than assuming array position.
  const earliestDate = sessions.reduce((min, s) => (s.date < min ? s.date : min), sessions[0].date)
  const daysOfHistory = daysBetween(earliestDate, today) + 1
  if (daysOfHistory < 14 || priorWindow === 0) return { current, deltaPct: null }

  const deltaPct = Math.round(((currentWindow - priorWindow) / priorWindow) * 100)
  return { current, deltaPct }
}
