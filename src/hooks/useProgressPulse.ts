import { useEffect, useState } from 'react'
import { loadProgressSnapshot } from './useProgressData'
import { getAllDailyTime, getLongestStreak } from '../services/db'
import { subscribeProgress } from '../services/progressEvents'
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

let cached: ProgressPulse | null = null
let cachedAt = 0
let inflight: Promise<ProgressPulse> | null = null
/** Bumped by every invalidation, so a read that started before a write cannot
 *  install its now-stale result as the cache when it finally resolves. */
let generation = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const subscribers = new Set<(p: ProgressPulse) => void>()

subscribeProgress(() => {
  // Invalidate immediately — correctness can't wait for the debounce, or a read
  // landing inside the window would be served pre-write numbers.
  generation++
  cached = null
  cachedAt = 0
  inflight = null

  // The refresh itself can wait. Nobody is subscribed on the screens that write
  // the most, and when someone is, the last write in a burst is the only one
  // whose result is worth computing.
  if (subscribers.size === 0) return
  if (refreshTimer != null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void load().then(p => subscribers.forEach(fn => fn(p)))
  }, REFRESH_DEBOUNCE_MS)
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
