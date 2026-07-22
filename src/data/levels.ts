/** Single source of truth for vocabulary level thresholds. */
export const LEVEL_THRESHOLDS = [
  { level: 1, words: 0 },
  { level: 2, words: 3000 },
  { level: 3, words: 6000 },
  { level: 4, words: 10000 },
]

/** First threshold above the given known-word count, or null at max level. */
export function nextLevelThreshold(knownWords: number) {
  return LEVEL_THRESHOLDS.find(t => t.words > knownWords) ?? null
}

export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--accent-yellow)',
  2: 'var(--accent-orange)',
  3: 'var(--accent-green)',
  4: 'var(--accent-blue)',
}
