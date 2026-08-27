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
  const recordUnlocks = useAppStore(s => s.recordUnlocks)

  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), [])

  useEffect(() => {
    let alive = true

    async function run() {
      const [snapshot, dailyTime, longestStreak, bestDayCount] = await Promise.all([
        loadProgressSnapshot(),
        getAllDailyTime(),
        getLongestStreak(),
        getBestDayWordCount(),
      ])
      if (!alive) return

      const latestUnlocks = useAppStore.getState().achievementUnlocks
      const { states, metrics } = evaluateAchievements(
        { snapshot, allPacks, dailyTime, longestStreak, bestDayCount },
        latestUnlocks
      )

      // Stamp anything newly earned. recordUnlocks only ever adds, so a badge
      // keeps its original date however many times this runs.
      const undated = states.filter(s => s.unlocked && s.unlockedAt == null)
      if (undated.length > 0) {
        recordUnlocks(undated.map(s => s.achievement.id), new Date().toISOString())
      }

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
  }, [tick, unlocks, recordUnlocks])

  return result
}
