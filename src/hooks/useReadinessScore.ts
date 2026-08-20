import { useEffect, useState } from 'react'
import { ProgressSnapshot, loadProgressSnapshot } from './useProgressData'

export interface ReadinessBreakdown {
  swiezosc: number
  retencja: number
  regularnosc: number
  mowienie: number
  skutecznosc: number
}

export interface ReadinessResult {
  score: number
  breakdown: ReadinessBreakdown
}

const WEIGHTS = {
  swiezosc: 0.25,
  retencja: 0.25,
  regularnosc: 0.20,
  mowienie: 0.15,
  skutecznosc: 0.15,
}

const MIN_SESSIONS_FOR_SCORE = 3

function freshnessScore(sessions: ProgressSnapshot['sessions']): number {
  if (sessions.length === 0) return 0
  const lastDate = sessions.map(s => s.date).sort().reverse()[0]
  const daysAgo = Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000)
  if (daysAgo <= 0) return 100
  if (daysAgo === 1) return 80
  if (daysAgo === 2) return 60
  if (daysAgo === 3) return 40
  if (daysAgo <= 6) return 20
  return 0
}

function retentionScore(wordProgress: ProgressSnapshot['wordProgress']): number {
  const seen = wordProgress.filter(w => w.seenCount > 0)
  if (seen.length === 0) return 0
  const known = seen.filter(w => w.status === 'known').length
  return Math.round((known / seen.length) * 100)
}

function regularityScore(streak: number): number {
  return Math.min(100, Math.round((streak / 7) * 100))
}

function speakingScore(sessions: ProgressSnapshot['sessions']): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const recent = sessions.filter(s => s.date >= cutoffStr)
  const totalWords = recent.reduce((sum, s) => sum + s.wordsCompleted, 0)
  if (totalWords === 0) return 0
  const speakingWords = recent
    .filter(s => s.autoplayMode === 'speaking')
    .reduce((sum, s) => sum + s.wordsCompleted, 0)
  const share = speakingWords / totalWords
  return Math.min(100, Math.round(share * 200))
}

function effectivenessScore(sessions: ProgressSnapshot['sessions']): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function windowAvg(startDaysAgo: number, endDaysAgo: number): number {
    const start = new Date(today)
    start.setDate(start.getDate() - startDaysAgo)
    const startStr = start.toISOString().split('T')[0]
    const end = new Date(today)
    end.setDate(end.getDate() - endDaysAgo)
    const endStr = end.toISOString().split('T')[0]
    const windowSessions = sessions.filter(s => s.date >= startStr && s.date <= endStr)
    if (windowSessions.length === 0) return 0
    return windowSessions.reduce((sum, s) => sum + s.wordsCompleted, 0) / windowSessions.length
  }

  const recentAvg = windowAvg(6, 0)
  if (recentAvg === 0) return 0

  // Personal best 7-day-window average across all of history, in 7-day steps back from today.
  let best = 0
  for (let offset = 0; offset < 52; offset++) {
    const avg = windowAvg(offset * 7 + 6, offset * 7)
    if (avg > best) best = avg
  }
  if (best === 0) return 0
  return Math.min(100, Math.round((recentAvg / best) * 100))
}

export function computeReadinessScore(snapshot: ProgressSnapshot): ReadinessResult | null {
  if (snapshot.sessions.length < MIN_SESSIONS_FOR_SCORE) return null

  const breakdown: ReadinessBreakdown = {
    swiezosc: freshnessScore(snapshot.sessions),
    retencja: retentionScore(snapshot.wordProgress),
    regularnosc: regularityScore(snapshot.streak),
    mowienie: speakingScore(snapshot.sessions),
    skutecznosc: effectivenessScore(snapshot.sessions),
  }

  const score = Math.round(
    breakdown.swiezosc * WEIGHTS.swiezosc +
    breakdown.retencja * WEIGHTS.retencja +
    breakdown.regularnosc * WEIGHTS.regularnosc +
    breakdown.mowienie * WEIGHTS.mowienie +
    breakdown.skutecznosc * WEIGHTS.skutecznosc
  )

  return { score, breakdown }
}

/** Null while loading, or once loaded: null if there isn't enough history yet. */
export function useReadinessScore(): ReadinessResult | null | undefined {
  const [result, setResult] = useState<ReadinessResult | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    loadProgressSnapshot().then(snap => {
      if (alive) setResult(computeReadinessScore(snap))
    })
    return () => {
      alive = false
    }
  }, [])

  return result
}
