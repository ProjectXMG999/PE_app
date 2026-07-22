import { useState, useEffect, useCallback } from 'react'
import { DayActivity } from '../types/progress'
import { nextLevelFromTotalKnown } from '../data/levels'
import { loadProgressSnapshot, avgWordsPerDay } from './useProgressData'

export interface LevelStats {
  avgWordsPerDay: number
  nextLevel: number | 'MASTER' | null
  nextLevelWords: number | null
  levelPct: number
  daysToNextLevel: number | null
}

export function useStats() {
  const [streak, setStreak] = useState(0)
  const [knownWords, setKnownWords] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [startedPacks, setStartedPacks] = useState(0)
  const [masteredPacks, setMasteredPacks] = useState(0)
  const [totalWordsHeard, setTotalWordsHeard] = useState(0)
  const [estimatedMinutes, setEstimatedMinutes] = useState(0)
  const [activity, setActivity] = useState<DayActivity[]>([])
  const [levelStats, setLevelStats] = useState<LevelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    async function load() {
      try {
        const snap = await loadProgressSnapshot(tick > 0)
        const { sessions, packageProgress, knownTotal } = snap

        setStreak(snap.streak)
        setKnownWords(knownTotal)
        setSessionCount(sessions.length)
        setStartedPacks(packageProgress.length)
        setMasteredPacks(packageProgress.filter(p => p.masteredAt != null).length)

        const heard = sessions.reduce((sum, s) => sum + s.wordsCompleted, 0)
        setTotalWordsHeard(heard)
        setEstimatedMinutes(Math.round(heard * 8 / 60))

        // Build 7-day activity
        const days: DayActivity[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const count = sessions
            .filter(s => s.date === dateStr)
            .reduce((sum, s) => sum + s.wordsCompleted, 0)
          days.push({ date: dateStr, count })
        }
        setActivity(days)

        const avg = avgWordsPerDay(snap)
        const next = nextLevelFromTotalKnown(knownTotal)
        setLevelStats({
          avgWordsPerDay: avg,
          nextLevel: next?.level ?? null,
          nextLevelWords: next?.wordsToNext ?? null,
          levelPct: next?.pct ?? 100,
          daysToNextLevel: next
            ? (avg > 0 ? Math.ceil(next.wordsToNext / avg) : 0)
            : null,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tick])

  return { streak, knownWords, sessionCount, startedPacks, masteredPacks, totalWordsHeard, estimatedMinutes, activity, levelStats, loading, reload, tick }
}
