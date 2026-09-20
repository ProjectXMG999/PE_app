import { ProgressSnapshot } from '../hooks/useProgressData'
import { PackMeta } from '../types/vocabulary'

/**
 * "What should I do today?" — the one question the whole method claims to
 * answer. The rule is simply: the earliest pack on the route that isn't done,
 * because the order the packs are in *is* the curriculum.
 *
 * Two different notions of "done", one per mode:
 *  - Słuchaj is finished when every card has been played through — `listenedAt`
 *    records that, and `currentIndex` is the pointer it can resume from;
 *  - Trenuj is finished when every word is known, so it tracks knownMap and
 *    always restarts from the top.
 *
 * Lives here rather than inside a component because Dziś is now the only screen
 * that answers "what next" — Pakiety shows the whole route and prices every
 * option instead of recommending one.
 */

export interface NextPack {
  pack: PackMeta
  startIndex: number
  /** Words already mastered in this pack. */
  known: number
}

export function nextListenPack(packs: PackMeta[], snapshot: ProgressSnapshot | null): NextPack | null {
  if (packs.length === 0) return null
  if (!snapshot) return { pack: packs[0], startIndex: 0, known: 0 }

  for (const pack of packs) {
    const progress = snapshot.progressMap.get(pack.id)
    if (progress?.listenedAt == null) {
      // Resume from wherever playback actually stopped. Clamped because a
      // pointer at or past the end without a `listenedAt` would otherwise open
      // the pack on nothing.
      const idx = Math.min(progress?.currentIndex ?? 0, Math.max(pack.wordCount - 1, 0))
      return { pack, startIndex: idx, known: snapshot.knownMap.get(pack.id) ?? 0 }
    }
  }
  return null
}

export function nextTrainPack(packs: PackMeta[], snapshot: ProgressSnapshot | null): NextPack | null {
  if (packs.length === 0) return null
  if (!snapshot) return { pack: packs[0], startIndex: 0, known: 0 }

  for (const pack of packs) {
    const known = snapshot.knownMap.get(pack.id) ?? 0
    if (known < pack.wordCount) {
      return { pack, startIndex: 0, known }
    }
  }
  return null
}

/**
 * How many packs have been listened all the way through — the Słuchaj
 * counterpart to `knownTotal` (which is a Trenuj-only measure: a word only
 * counts as "known" once it's been actively recalled, not just heard). Packs,
 * not words, because Słuchaj doesn't track per-word mastery the way Trenuj
 * does.
 *
 * Reads `listenedAt` and nothing else. It used to test `currentIndex` against
 * the word count, and half the app wrote that field for reasons having nothing
 * to do with audio — which is how a declared level reported itself as 100%
 * listened. See services/listenAxis.ts.
 */
export function listenedPacksCount(packs: PackMeta[], snapshot: ProgressSnapshot | null): number {
  if (!snapshot) return 0
  let count = 0
  for (const pack of packs) {
    if (snapshot.progressMap.get(pack.id)?.listenedAt != null) count++
  }
  return count
}

/**
 * Unlistened packs BEHIND the frontier — the backlog Dziś doesn't route you
 * through. `nextListenPack` is handed the packs from the frontier onwards, so
 * without this the ones you skipped past would simply stop existing; the
 * counter keeps them visible and reachable from Pakiety.
 */
export function listenBacklogCount(
  packs: PackMeta[],
  snapshot: ProgressSnapshot | null,
  frontier: PackMeta | null,
): number {
  if (!snapshot || !frontier) return 0
  let count = 0
  for (const pack of packs) {
    if (pack.id === frontier.id) break
    if (snapshot.progressMap.get(pack.id)?.listenedAt == null) count++
  }
  return count
}

/**
 * Cumulative pack count at each of the 4 level boundaries — the Słuchaj
 * counterpart to LEVEL_META's word thresholds, so ListenStrip can mark
 * "stations" on its pack-based track the same way RouteStrip marks them on
 * its word-based one. Index 0 = packs at level <= 1, ... index 3 = all packs.
 */
export function packLevelThresholds(packs: PackMeta[]): number[] {
  const counts = [0, 0, 0, 0]
  for (const pack of packs) {
    for (let lvl = pack.level; lvl <= 4; lvl++) counts[lvl - 1]++
  }
  return counts
}

/**
 * Rough minutes for a pack, used only to set expectations on the Dziś card.
 * Based on the same 8 s/word figure the app has always shown; once enough real
 * durations accumulate, `wordsPerMinute` from the user's own history is a better
 * source and this stays a fallback for a cold start.
 */
export function estimateMinutes(wordCount: number, wordsPerMinute = 0): number {
  if (wordsPerMinute > 0) return Math.max(1, Math.round(wordCount / wordsPerMinute))
  return Math.max(1, Math.round((wordCount * 8) / 60))
}
