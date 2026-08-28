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
  /** calm / building / urgent. */
  reviewUrgency: ReviewUrgency
  /** Seconds studied today. */
  secondsToday: number
  goalSec: number
  goalPct: number
  goalMet: boolean
}

const CACHE_MS = 60_000

let cached: ProgressPulse | null = null
let cachedAt = 0
let inflight: Promise<ProgressPulse> | null = null

const subscribers = new Set<(p: ProgressPulse) => void>()

subscribeProgress(() => {
  cached = null
  cachedAt = 0
  inflight = null
  // A write means the visible numbers are wrong right now, so refresh eagerly
  // rather than waiting for the next mount.
  if (subscribers.size > 0) {
    void load().then(p => subscribers.forEach(fn => fn(p)))
  }
})

async function load(): Promise<ProgressPulse> {
  const now = Date.now()
  if (cached != null && now - cachedAt < CACHE_MS) return cached
  if (inflight != null) return inflight

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
      reviewUrgency: snapshot.reviewUrgency,
      secondsToday: today.secondsStudied,
      goalSec: today.goalSec,
      goalPct: today.pct,
      goalMet: today.goalMet,
    }

    cached = pulse
    cachedAt = Date.now()
    inflight = null
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
