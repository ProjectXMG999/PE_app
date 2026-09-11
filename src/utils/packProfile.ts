import { PackMeta } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { retrievabilityOf } from '../services/reviewQueue'
import { dayKey } from './day'

/**
 * The join nothing in the app was doing.
 *
 * Every ingredient for "which kinds of words are hard *for you*" was already
 * indexed — `lapseCount`, `difficulty`, `stability`, `seenCount` per word, and
 * `category` / `level` per pack — but the only aggregations anywhere were
 * counts. `CategoryProgressBars` and `LevelProgressBars` tell you how many
 * words you know per category; nothing told you how well.
 *
 * This module answers two questions the page needs in order to have an opinion:
 *   - where is your weak spot (→ an honest alternative to "just do the next one")
 *   - what will this specific pack cost *you* (→ a real choice instead of a leap)
 */

export interface CategoryStat {
  category: string
  /** Words with a verdict recorded. Below `MIN_SAMPLE` nothing is claimed. */
  sample: number
  known: number
  /** known / sample as a percentage. */
  successPct: number
  /** Mean recall probability across known words, 0–1 (null when none). */
  strength: number | null
  /** Mean FSRS difficulty across words that have one, 1–10 (null when none). */
  difficulty: number | null
  lapses: number
  /** True once there is enough data to say anything. */
  reliable: boolean
}

/** Below this many rated words a category's success rate is noise. */
export const MIN_SAMPLE = 12

/** Population mean of FSRS difficulty, used as the "average" reference point. */
const NEUTRAL_DIFFICULTY = 5.3

export function categoryStats(
  packs: PackMeta[],
  snapshot: ProgressSnapshot | null,
): CategoryStat[] {
  if (!snapshot) return []
  const today = dayKey()
  const catOf = new Map(packs.map(p => [p.id, p.category]))

  interface Acc {
    sample: number; known: number; lapses: number
    rSum: number; rN: number; dSum: number; dN: number
  }
  const acc = new Map<string, Acc>()

  for (const wp of snapshot.wordProgress) {
    const cat = catOf.get(wp.packageId)
    if (!cat) continue
    // A word only carries information once it has actually been seen.
    if ((wp.seenCount ?? 0) === 0) continue

    let a = acc.get(cat)
    if (!a) { a = { sample: 0, known: 0, lapses: 0, rSum: 0, rN: 0, dSum: 0, dN: 0 }; acc.set(cat, a) }

    a.sample++
    if (wp.status === 'known') a.known++
    a.lapses += wp.lapseCount ?? 0
    if (wp.difficulty != null) { a.dSum += wp.difficulty; a.dN++ }
    if (wp.status === 'known') {
      const r = wp.retiredAt != null ? 1 : retrievabilityOf(wp, today)
      if (r != null) { a.rSum += r; a.rN++ }
    }
  }

  return [...acc.entries()].map(([category, a]) => ({
    category,
    sample: a.sample,
    known: a.known,
    successPct: a.sample > 0 ? Math.round((a.known / a.sample) * 100) : 0,
    strength: a.rN > 0 ? a.rSum / a.rN : null,
    difficulty: a.dN > 0 ? a.dSum / a.dN : null,
    lapses: a.lapses,
    reliable: a.sample >= MIN_SAMPLE,
  })).sort((x, y) => x.successPct - y.successPct)
}

/**
 * Your weakest category — the honest "instead of the next pack, fix this".
 * Returns null until at least one category has a usable sample, and ignores
 * categories you're already good at.
 */
export function weakestCategory(stats: CategoryStat[], ceilingPct = 85): CategoryStat | null {
  return stats.find(s => s.reliable && s.successPct < ceilingPct) ?? null
}

export interface PackCost {
  /** Estimated minutes for THIS user, from their own measured pace. */
  minutes: number
  /**
   * How this pack compares to the user's own average effort:
   * < 0.9 easier, > 1.1 harder, null when there is nothing to compare against.
   */
  relativeEffort: number | null
  /** Words still to learn here. */
  remaining: number
}

/**
 * Measured seconds per word, from real sessions.
 *
 * Falls back to the app's existing 8 s/word estimate (`useStats`'s
 * ESTIMATED_SECONDS_PER_WORD) until there is enough history to beat it.
 */
export function secondsPerWord(snapshot: ProgressSnapshot | null): number {
  if (!snapshot) return 8
  let sec = 0
  let words = 0
  for (const s of snapshot.sessions) {
    if (s.durationSec == null || s.wordsCompleted <= 0) continue
    sec += s.durationSec
    words += s.wordsCompleted
  }
  if (words < 30) return 8
  // Clamped: a session left open in a background tab would otherwise poison it.
  return Math.min(30, Math.max(3, sec / words))
}

/**
 * What this pack will cost this user — the answer to "what am I choosing".
 *
 * Effort is predicted from the FSRS difficulty the user has actually
 * accumulated in this pack's category, because that is the only evidence we
 * have about how they cope with this kind of word. With no evidence it returns
 * null rather than guessing — an unlabelled guess would be worse than silence.
 */
export function packCost(
  pack: PackMeta,
  snapshot: ProgressSnapshot | null,
  stats: CategoryStat[],
  perWordSec = secondsPerWord(snapshot),
): PackCost {
  const known = snapshot?.knownMap.get(pack.id) ?? 0
  const remaining = Math.max(0, pack.wordCount - known)

  const stat = stats.find(s => s.category === pack.category)
  const relativeEffort = stat?.reliable && stat.difficulty != null
    ? stat.difficulty / NEUTRAL_DIFFICULTY
    : null

  const effortFactor = relativeEffort ?? 1
  const minutes = Math.max(1, Math.round((remaining * perWordSec * effortFactor) / 60))
  return { minutes, relativeEffort, remaining }
}

/** Human label for `relativeEffort`, or null when we shouldn't claim anything. */
export function effortLabel(relativeEffort: number | null): string | null {
  if (relativeEffort == null) return null
  if (relativeEffort > 1.1) return 'trudniejszy dla Ciebie'
  if (relativeEffort < 0.9) return 'łatwiejszy dla Ciebie'
  return null
}

/** Words in this pack that a single successful review would retire. */
export function nearlySealed(
  pack: PackMeta,
  snapshot: ProgressSnapshot | null,
  threshold = 0.55,
): number {
  if (!snapshot) return 0
  const words = snapshot.wordProgress.filter(w => w.packageId === pack.id)
  if (words.length === 0) return 0
  return words.filter(w => isOneReviewFromRetiring(w, threshold)).length
}

/**
 * The same count for every pack at once — packId → how many of its words are
 * one review from retiring.
 *
 * `nearlySealed` filters the whole word list per pack, which is fine for one
 * card and quadratic for a catalogue of 864. The "Blisko »Na stałe«" lens needs
 * this for the entire route on every render, so it gets a single pass instead.
 * Packs with zero such words are simply absent from the map.
 */
export function nearlySealedByPack(
  snapshot: ProgressSnapshot | null,
  threshold = 0.55,
): Map<string, number> {
  const out = new Map<string, number>()
  if (!snapshot) return out
  for (const wp of snapshot.wordProgress) {
    if (!isOneReviewFromRetiring(wp, threshold)) continue
    out.set(wp.packageId, (out.get(wp.packageId) ?? 0) + 1)
  }
  return out
}

/**
 * A word close enough to the retirement threshold that one more "Znam" would
 * very likely carry it over. `RETIRE_STABILITY_DAYS` is 365 and a successful
 * review roughly multiplies stability, so the band starts well below it.
 */
export function isOneReviewFromRetiring(wp: WordProgress, threshold = 0.55): boolean {
  if (wp.status !== 'known' || wp.retiredAt != null) return false
  const s = wp.stability
  if (s == null) return false
  return s >= 365 * threshold && s < 365
}
