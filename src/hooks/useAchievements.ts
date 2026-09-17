import { useEffect, useState } from 'react'
import { loadProgressSnapshot } from './useProgressData'
import { getAllDailyTime, getBestDayWordCount, getLongestStreak } from '../services/db'
import { subscribeProgress } from '../services/progressEvents'
import { AchievementState, MetricValues, evaluateAchievements } from '../services/achievements'
import { PointsResult, computePoints } from '../services/points'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

const allPacks = packagesIndex as PackMeta[]

export interface AchievementsResult {
  states: AchievementState[]
  metrics: MetricValues
  points: PointsResult
  /** Badges earned but not yet celebrated. */
  fresh: AchievementState[]
}

/**
 * Reads everything the badges are measured from, evaluates them, and stamps
 * any that are newly earned. Shared by the Postęp cabinet and the app-wide
 * AchievementWatcher, so a badge is dated the same way whichever sees it first.
 */
export async function evaluateAchievementsNow() {
  const [snapshot, dailyTime, longestStreak, bestDayCount] = await Promise.all([
    loadProgressSnapshot(),
    getAllDailyTime(),
    getLongestStreak(),
    getBestDayWordCount(),
  ])

  const store = useAppStore.getState()
  const input = { snapshot, allPacks, dailyTime, longestStreak, bestDayCount }
  let { states, metrics } = evaluateAchievements(input, store.achievementUnlocks)

  // Stamp anything newly earned. recordUnlocks only ever adds, so a badge
  // keeps its original date however many times this runs.
  const undated = states.filter(s => s.unlocked && s.unlockedAt == null)
  if (undated.length > 0) {
    store.recordUnlocks(undated.map(s => s.achievement.id), new Date().toISOString())
    ;({ states, metrics } = evaluateAchievements(input, useAppStore.getState().achievementUnlocks))
  }

  return { states, metrics, snapshot, longestStreak }
}

/**
 * Derives badges and points, and records the first time each badge is earned.
 *
 * The recording step is what makes "zdobyte 3 dni temu" possible at all: the
 * badges themselves are recomputed from progress on every read, so without a
 * stamp there'd be no way to tell a badge earned this morning from one earned
 * in March.
 */
export function useAchievements(): AchievementsResult | null {
  const [result, setResult] = useState<AchievementsResult | null>(null)
  const [tick, setTick] = useState(0)

  const unlocks = useAppStore(s => s.achievementUnlocks)

  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), [])

  useEffect(() => {
    let alive = true

    async function run() {
      const { states, metrics, snapshot, longestStreak } = await evaluateAchievementsNow()
      if (!alive) return

      const points = computePoints(snapshot, {
        longestStreak,
        goalDays: metrics.goalDays,
      })

      setResult({
        states,
        metrics,
        points,
        fresh: states.filter(s => s.isNew),
      })
    }

    run()
    return () => {
      alive = false
    }
    // `unlocks` is a dependency so the freshly stamped dates flow back into the
    // rendered state on the next pass.
  }, [tick, unlocks])

  return result
}
