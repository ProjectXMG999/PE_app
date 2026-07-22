import { PackMeta } from '../types/vocabulary'

export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--accent-yellow)',
  2: 'var(--accent-orange)',
  3: 'var(--accent-green)',
  4: 'var(--accent-blue)',
}

export interface NextLevelInfo {
  level: number
  wordsToNext: number
  pct: number
}

/**
 * First level (1-4) not yet fully known, based on real per-pack word counts
 * (same grouping LevelProgressBars uses), instead of arbitrary global totals.
 */
export function nextLevelFromPacks(allPacks: PackMeta[], knownMap: Map<string, number>): NextLevelInfo | null {
  for (const lvl of [1, 2, 3, 4] as const) {
    const packs = allPacks.filter(p => p.level === lvl)
    const total = packs.reduce((s, p) => s + p.wordCount, 0)
    const known = packs.reduce((s, p) => s + (knownMap.get(p.id) ?? 0), 0)
    if (known < total) {
      return {
        level: lvl,
        wordsToNext: total - known,
        pct: total > 0 ? Math.min(100, Math.round((known / total) * 100)) : 100,
      }
    }
  }
  return null
}
