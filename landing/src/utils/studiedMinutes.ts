// Hand-extracted from src/hooks/useStats.ts (main app) — only the pure
// studiedMinutes() function plus its private constant, not the whole hook
// file (which reaches into useAppStore/services/db/useProgressData at
// module scope). Used by services/achievements.ts's `minutes` metric.
import { Session } from '../types/progress'

const ESTIMATED_SECONDS_PER_WORD = 8

export function studiedMinutes(sessions: Session[]): number {
  const seconds = sessions.reduce(
    (sum, s) => sum + (s.durationSec ?? s.wordsCompleted * ESTIMATED_SECONDS_PER_WORD),
    0
  )
  return Math.round(seconds / 60)
}
