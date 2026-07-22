export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--accent-yellow)',
  2: 'var(--accent-orange)',
  3: 'var(--accent-green)',
  4: 'var(--accent-blue)',
}

// Cumulative known-word thresholds that define overall vocabulary knowledge
// levels — independent of which difficulty tier a pack is tagged with.
export const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 1000,
  2: 3000,
  3: 6000,
  4: 10000,
}

export interface NextLevelInfo {
  level: number
  wordsToNext: number
  pct: number
}

/**
 * Knowledge level derived from the total count of mastered words across the
 * whole app (not per pack-level). Returns the next level to reach, how many
 * more mastered words that takes, and progress (%) through the current band.
 */
export function nextLevelFromTotalKnown(knownTotal: number): NextLevelInfo | null {
  let prevThreshold = 0
  for (const lvl of [1, 2, 3, 4] as const) {
    const threshold = LEVEL_THRESHOLDS[lvl]
    if (knownTotal < threshold) {
      const span = threshold - prevThreshold
      const progressed = knownTotal - prevThreshold
      return {
        level: lvl,
        wordsToNext: threshold - knownTotal,
        pct: span > 0 ? Math.min(100, Math.max(0, Math.round((progressed / span) * 100))) : 100,
      }
    }
    prevThreshold = threshold
  }
  return null
}
