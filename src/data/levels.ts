export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--accent-yellow)',
  2: 'var(--accent-orange)',
  3: 'var(--accent-green)',
  4: 'var(--accent-blue)',
}

// Cumulative known-word thresholds that define overall vocabulary knowledge
// tiers — independent of which difficulty tier a pack is tagged with.
// Everyone starts at Level 1, so each entry is how many words it takes to
// REACH that tier (there's no threshold for Level 1 itself). MASTER is the
// final tier beyond Level 4.
const LEVEL_TIERS: { level: number | 'MASTER'; threshold: number }[] = [
  { level: 2, threshold: 1000 },
  { level: 3, threshold: 3000 },
  { level: 4, threshold: 6000 },
  { level: 'MASTER', threshold: 10000 },
]

export interface NextLevelInfo {
  level: number | 'MASTER'
  wordsToNext: number
  pct: number
}

/**
 * Knowledge tier derived from the total count of mastered words across the
 * whole app (not per pack-level). Returns the next tier to reach, how many
 * more mastered words that takes, and progress (%) through the current band.
 * Returns null once MASTER (the final tier) has been reached.
 */
export function nextLevelFromTotalKnown(knownTotal: number): NextLevelInfo | null {
  let prevThreshold = 0
  for (const tier of LEVEL_TIERS) {
    if (knownTotal < tier.threshold) {
      const span = tier.threshold - prevThreshold
      const progressed = knownTotal - prevThreshold
      return {
        level: tier.level,
        wordsToNext: tier.threshold - knownTotal,
        pct: span > 0 ? Math.min(100, Math.max(0, Math.round((progressed / span) * 100))) : 100,
      }
    }
    prevThreshold = tier.threshold
  }
  return null
}
