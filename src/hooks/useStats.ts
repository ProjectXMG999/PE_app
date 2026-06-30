import { useState, useEffect } from 'react'
import { getAllSessions, getStreak, getTotalKnownWords, getAllPackageProgress } from '../services/db'
import { DayActivity } from '../types/progress'

export function useStats() {
  const [streak, setStreak] = useState(0)
  const [knownWords, setKnownWords] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [startedPacks, setStartedPacks] = useState(0)
  const [masteredPacks, setMasteredPacks] = useState(0)
  const [activity, setActivity] = useState<DayActivity[]>([])
  const [loading, setLoading] = useState(true)

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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { streak, knownWords, sessionCount, startedPacks, masteredPacks, activity, loading }
}
