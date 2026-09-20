import { useEffect, useState } from 'react'
import { loadProgressSnapshot } from './useProgressData'
import { measuredStudyMinutes } from './useStats'
import { getAllDailyTime } from '../services/db'
import { studyWordsPerMinute } from '../utils/pace'

export interface LearningRate {
  knownWords: number
  /** Measured words per minute of study; 0 until there's study time to measure. */
  wordsPerMinute: number
}

/** The user's own measured learning rate, for projections outside Postęp.
 *  Null while loading. */
export function useLearningRate(): LearningRate | null {
  const [rate, setRate] = useState<LearningRate | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([loadProgressSnapshot(), getAllDailyTime()]).then(([snapshot, dailyTime]) => {
      if (!alive) return
      const minutes = measuredStudyMinutes(dailyTime, snapshot.sessions)
      setRate({
        knownWords: snapshot.knownTotal,
        wordsPerMinute: studyWordsPerMinute(snapshot.knownTotal, snapshot.declaredKnownTotal ?? 0, minutes),
      })
    })
    return () => { alive = false }
  }, [])

  return rate
}
