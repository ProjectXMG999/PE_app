import { PackMeta } from '../types/vocabulary'
import { LEVEL_META, LevelMeta, MARKER_STEP } from '../data/levels'

/**
 * Landmarks along the route.
 *
 * A milestone is a fixed *place on the map*, not a fact about the user: the
 * 1 000-word station sits wherever the curriculum's 1 000th word lives, and you
 * have either reached it or not. That's the same semantics RouteMap uses on
 * Postęp, so the two screens agree about where the stations are.
 *
 * Two sizes, because the landing promises both:
 *  - `station` — a level threshold (1 000 / 3 000 / 6 000 / 10 000), full-bleed,
 *    named, dated once earned;
 *  - `tick` — every 100 words, a hairline. "Każde kolejne 100 słów staje się
 *    małym momentem sukcesu" — at ~one per nine packs it reads as ruled paper,
 *    giving a long scroll a pulse instead of leaving it uniform.
 */

export interface Milestone {
  /** Cumulative curriculum words at this point in the route. */
  words: number
  kind: 'station' | 'tick'
  /** Present on stations only. */
  level?: LevelMeta
}

const LEVEL_BY_THRESHOLD = new Map(LEVEL_META.map(l => [l.threshold, l]))

/**
 * packId → the milestone that falls immediately *before* that pack.
 *
 * Computed once for the whole catalogue (it depends only on the static index),
 * so rendering the list is a map lookup per row.
 */
export function milestonesFor(packs: PackMeta[]): Map<string, Milestone> {
  const out = new Map<string, Milestone>()
  let cumulative = 0
  let nextTick = MARKER_STEP

  for (const pack of packs) {
    // Every marker the previous packs' words just carried us past. A single pack
    // can cross more than one, so walk them; the largest wins the row, and a
    // station always outranks a tick.
    let crossed: Milestone | null = null
    while (nextTick <= cumulative) {
      const level = LEVEL_BY_THRESHOLD.get(nextTick)
      const milestone: Milestone = level
        ? { words: nextTick, kind: 'station', level }
        : { words: nextTick, kind: 'tick' }
      if (!crossed || milestone.kind === 'station') crossed = milestone
      nextTick += MARKER_STEP
    }
    if (crossed) out.set(pack.id, crossed)
    cumulative += pack.wordCount
  }
  return out
}
