import { ProgressSnapshot } from '../hooks/useProgressData'
import { PackMeta } from '../types/vocabulary'

/**
 * "What should I do today?" — the one question the whole method claims to
 * answer. The rule is simply: the earliest pack on the route that isn't done,
 * because the order the packs are in *is* the curriculum.
 *
 * Two different notions of "done", one per mode:
 *  - Słuchaj is finished when every card has been played through, so it tracks
 *    currentIndex and can resume mid-pack;
 *  - Trenuj is finished when every word is known, so it tracks knownMap and
 *    always restarts from the top.
 *
 * Extracted from QuickStartCards so the Dziś screen answers with exactly the
 * same pack the home screen would.
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
    const idx = snapshot.progressMap.get(pack.id)?.currentIndex ?? 0
    if (idx < pack.wordCount) {
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
 * does — `currentIndex` only tells you how far into the pack playback got.
 */
export function listenedPacksCount(packs: PackMeta[], snapshot: ProgressSnapshot | null): number {
  if (!snapshot) return 0
  let count = 0
  for (const pack of packs) {
    const idx = snapshot.progressMap.get(pack.id)?.currentIndex ?? 0
    if (idx >= pack.wordCount) count++
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
