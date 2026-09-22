import { useEffect, useState } from 'react'
import { loadProgressSnapshot } from './useProgressData'
import { getAllDailyTime, getLongestStreak } from '../services/db'
import { subscribeProgress, type ProgressEventKind } from '../services/progressEvents'
import { computePoints } from '../services/points'
import { ReviewUrgency } from '../services/reviewQueue'
import { todayProgress } from '../services/dailyTime'

/**
 * The few numbers the always-visible streak/points widget needs.
 *
 * This runs in AppShell, so it renders on *every* screen. Reading all sessions
 * and every wordProgress row (up to ~11 400) on each navigation would be a real
 * cost, so the result is cached across mounts for a minute and invalidated
 * explicitly whenever progress is written — see services/progressEvents.
 */

export interface ProgressPulse {
  streak: number
  points: number
  knownWords: number
  /** Raw review backlog (every due, non-retired word). */
  dueCount: number
  /** How many of today's review budget are still unshown. */
  servingLeft: number
  /** Today's review budget. */
  reviewBudget: number
  /** Measured seconds per review card — what turns the counts above into the
   *  "ok. N min" beside them. See reviewQueue.reviewSecPerCard. */
  reviewSecPerCard: number
  /** calm / building / urgent. */
  reviewUrgency: ReviewUrgency
  /** Seconds studied today. */
  secondsToday: number
  goalSec: number
  goalPct: number
  goalMet: boolean
}

const CACHE_MS = 60_000

/**
 * Progress writes arrive in bursts, and this refresh is far too expensive to
 * run once per write.
 *
 * `load()` reads every wordProgress row (~11 400) plus all sessions and the
 * daily-time ledger, then runs several passes over them — all on the main
 * thread. The widget is mounted during study sessions (FlashcardPage keeps the
 * TopBar), so it was doing that work once per rated card. Worse in bulk:
 * "Znam wszystko" on a 40-word pack does
 * `Promise.all(allWords.map(saveWordProgress))`, and each of those emits, so
 * forty full recomputations were started at once — a multi-second freeze rather
 * than a dropped frame. `markLevelMastered` emits twice in a row for the same
 * reason.
 *
 * Coalescing them costs a quarter second of staleness on a number nobody is
 * watching mid-write.
 */
const REFRESH_DEBOUNCE_MS = 250

/**
 * …and a debounce alone turned out not to be enough.
 *
 * A debounce coalesces a burst. It does nothing about a steady cadence: a
 * learner answering a card every ~3 s re-armed the 250 ms timer, it expired
 * between cards, and the full refresh ran once per card after all — a cold
 * `loadProgressSnapshot` (six `getAll`s, ~11 000 rows deserialised on the main
 * thread) plus `getAllDailyTime`, `getLongestStreak`, `todayProgress` and
 * `computePoints`, in the middle of a study session. What is needed is a
 * MINIMUM INTERVAL, and only for the kinds that can afford one.
 *
 * `'word'` and `'dailyTime'` are the per-card drip. Everything else is a
 * boundary the user can point at — finishing a session, a pack completing, a
 * level declaration, a sign-in merge — and those stay immediate.
 *
 * The split is safe because of an invariant worth stating: **every bulk write
 * in the app already emits a `package` or `reset` alongside its `word`
 * events.** "Znam wszystko" writes the words then the package; level mastery
 * and its undo emit both; a merge emits `reset`. So the only thing that can go
 * stale is the points figure between single cards, and only for QUIET_MS. The
 * streak cannot move mid-session at all — `getStreak` is day-granular, and the
 * day is already marked by the `dailyTime` write.
 */
const QUIET_MS = 15_000

/** Kinds that must be reflected at once. Not a performance judgement — these
 *  are the moments a user would notice a number failing to move. */
const IMMEDIATE: ReadonlySet<ProgressEventKind> = new Set<ProgressEventKind>([
  'session', 'package', 'reset', 'reviewLedger',
])

/**
 * How long to wait before refreshing, given what just changed.
 *
 * Exported for its test: the case that would silently regress is a `'word'`
 * followed by a `'package'` — the pair a bulk declaration emits — where the
 * second must pull the refresh in to 250 ms rather than inheriting the first's
 * long fuse.
 */
export function refreshDelayFor(
  kind: ProgressEventKind,
  now: number,
  lastRefreshAt: number,
): number {
  if (IMMEDIATE.has(kind)) return REFRESH_DEBOUNCE_MS
  return Math.max(REFRESH_DEBOUNCE_MS, QUIET_MS - (now - lastRefreshAt))
}

let cached: ProgressPulse | null = null
let cachedAt = 0
let inflight: Promise<ProgressPulse> | null = null
/** Bumped by every invalidation, so a read that started before a write cannot
 *  install its now-stale result as the cache when it finally resolves. */
let generation = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null
/** When the pending refresh is due, so an immediate kind arriving after a quiet
 *  one can pull it in rather than being pushed back behind it. */
let refreshDue = Infinity
let lastRefreshAt = 0

const subscribers = new Set<(p: ProgressPulse) => void>()

subscribeProgress(kind => {
  // Invalidate immediately, on EVERY kind. This is the correctness anchor the
  // 60s snapshot cache rests on and it costs nothing — only the refresh below
  // is rescheduled. A page mounting after any write still reads fresh.
  generation++
  cached = null
  cachedAt = 0
  inflight = null

  // The refresh itself can wait. Nobody is subscribed on four of the five
  // session screens — only Fiszki mounts AppShell, so only there is the pill
  // on screen — and when someone is, the last write in a run is the only one
  // whose result is worth computing.
  if (subscribers.size === 0) return

  const delay = refreshDelayFor(kind, Date.now(), lastRefreshAt)
  const at = Date.now() + delay
  // Earliest deadline wins, same rule AchievementWatcher.schedule uses: a
  // `package` landing after a `word` must bring the refresh forward.
  if (refreshTimer != null && at >= refreshDue) return
  if (refreshTimer != null) clearTimeout(refreshTimer)
  refreshDue = at
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    refreshDue = Infinity
    lastRefreshAt = Date.now()
    void load().then(p => subscribers.forEach(fn => fn(p)))
  }, delay)
})

async function load(): Promise<ProgressPulse> {
  const now = Date.now()
  if (cached != null && now - cachedAt < CACHE_MS) return cached
  if (inflight != null) return inflight

  const gen = generation

  inflight = (async () => {
    const [snapshot, dailyTime, longestStreak, today] = await Promise.all([
      loadProgressSnapshot(),
      getAllDailyTime(),
      getLongestStreak(),
      todayProgress(),
    ])

    const goalDays = dailyTime.filter(d => d.goalMetAt != null).length
    const { total } = computePoints(snapshot, { longestStreak, goalDays })

    const pulse: ProgressPulse = {
      streak: snapshot.streak,
      points: total,
      knownWords: snapshot.knownTotal,
      dueCount: snapshot.dueCount,
      servingLeft: snapshot.servingLeft,
      reviewBudget: snapshot.reviewBudget,
      reviewSecPerCard: snapshot.reviewSecPerCard,
      reviewUrgency: snapshot.reviewUrgency,
      secondsToday: today.secondsStudied,
      goalSec: today.goalSec,
      goalPct: today.pct,
      goalMet: today.goalMet,
    }

    // A write landed while this read was in flight: the numbers are already
    // out of date, so hand them to the caller that asked but leave the cache
    // (and whatever newer read now owns `inflight`) alone.
    if (gen === generation) {
      cached = pulse
      cachedAt = Date.now()
      inflight = null
    }
    return pulse
  })()

  return inflight
}

/** Null until the first read completes. */
export function useProgressPulse(): ProgressPulse | null {
  const [pulse, setPulse] = useState<ProgressPulse | null>(cached)

  useEffect(() => {
    let alive = true
    subscribers.add(setPulse)
    load().then(p => {
      if (alive) setPulse(p)
    })
    return () => {
      alive = false
      subscribers.delete(setPulse)
    }
  }, [])

  return pulse
}
