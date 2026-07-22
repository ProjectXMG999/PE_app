import { useState, useEffect, useCallback } from 'react'
import { getAllSessions, getStreak, getTotalKnownWords, getAllPackageProgress } from '../services/db'
import { DayActivity } from '../types/progress'

const LEVEL_THRESHOLDS = [
  { level: 2, words: 3000 },
  { level: 3, words: 6000 },
  { level: 4, words: 10000 },
]

export interface LevelStats {
  avgWordsPerDay: number
  nextLevel: number | null
  nextLevelWords: number | null
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
        const [s, kw, sessions, packs] = await Promise.all([
          getStreak(),
          getTotalKnownWords(),
          getAllSessions(),
          getAllPackageProgress(),
        ])

        setStreak(s)
        setKnownWords(kw)
        setSessionCount(sessions.length)
        setStartedPacks(packs.length)
        setMasteredPacks(packs.filter(p => p.masteredAt != null).length)

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

        // Calculate level stats
        const avgWordsPerDay = sessions.length > 0
          ? (() => {
              const firstSession = sessions[sessions.length - 1]
              const lastSession = sessions[0]
              const startDate = new Date(firstSession.date)
              const endDate = new Date(lastSession.date)
              const daysElapsed = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
              return Math.round(kw / daysElapsed)
            })()
          : 0

        const nextLevelThreshold = LEVEL_THRESHOLDS.find(t => t.words > kw)
        const daysToNextLevel = nextLevelThreshold
          ? (avgWordsPerDay > 0
              ? Math.ceil((nextLevelThreshold.words - kw) / avgWordsPerDay)
              : 0)  // Show 0 if no progress yet
          : null

        setLevelStats({
          avgWordsPerDay,
          nextLevel: nextLevelThreshold?.level ?? null,
          nextLevelWords: nextLevelThreshold?.words ?? null,
          daysToNextLevel,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tick])

  return { streak, knownWords, sessionCount, startedPacks, masteredPacks, totalWordsHeard, estimatedMinutes, activity, levelStats, loading, reload, tick }
}
