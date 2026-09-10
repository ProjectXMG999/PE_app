import { PackMeta } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { retrievabilityOf } from '../services/reviewQueue'
import { dayKey } from './day'

/**
 * Your *relationship* with a pack — the one thing the Atlas paints.
 *
 * A pack is not just done/undone. Four states carry the whole map:
 *
 *  - `held`    — conquered and holding. Gold, calm.
 *  - `fading`  — conquered, but the memory is decaying. Amber core.
 *  - `active`  — the frontier or a pack in progress. Violet, alive.
 *  - `ahead`   — untouched territory. Dim, under fog.
 *
 * ── The rule that must never break ───────────────────────────────────────────
 * Fading is NOT losing. A pack that was ever conquered keeps `everHeld: true`
 * forever, and the Atlas keeps its gold rim on that node regardless of decay —
 * only the fill dims. `known` is a permanent status in the data model, badges
 * never un-earn, and `knownTotal` never goes down; this file must not be the
 * one place that contradicts that. Honest about memory, never punitive about
 * achievement.
 */

export type PackRelation = 'held' | 'fading' | 'active' | 'ahead'

/**
 * Below this recall probability a conquered pack reads as "coming back to you".
 * 0.7 sits under FSRS's 0.9 scheduling target, so a pack only turns amber once
 * it is meaningfully past due — not the moment its interval elapses.
 */
export const FADING_RETRIEVABILITY = 0.7

export interface PackMemory {
  relation: PackRelation
  /** Mean recall probability across the pack's known words, 0–1. */
  strength: number
  /** Words with status 'known'. */
  known: number
  total: number
  /** True once every word was known, even if it has since decayed. */
  everHeld: boolean
}

/**
 * Mean recall probability across a pack's known words today. Returns 1 when
 * nothing is known, so an untouched pack never reads as "fading".
 *
 * Words without FSRS state yet (`retrievabilityOf` → null) count as fully held:
 * the scheduler hasn't made a claim about them, so neither do we.
 */
function packStrength(words: WordProgress[], today: string): number {
  let sum = 0
  let n = 0
  for (const wp of words) {
    if (wp.status !== 'known') continue
    // Retired words are out of rotation by design — they read as fully held.
    const r = wp.retiredAt != null ? 1 : retrievabilityOf(wp, today)
    sum += r ?? 1
    n++
  }
  return n > 0 ? sum / n : 1
}

/**
 * Classify every pack in one pass over `wordProgress`, so the Atlas can paint
 * 864 nodes without re-scanning per pack.
 */
export function buildPackMemory(
  packs: PackMeta[],
  snapshot: ProgressSnapshot | null,
): Map<string, PackMemory> {
  const out = new Map<string, PackMemory>()
  if (!snapshot) {
    for (const p of packs) {
      out.set(p.id, { relation: 'ahead', strength: 1, known: 0, total: p.wordCount, everHeld: false })
    }
    return out
  }

  const today = dayKey()
  const byPack = new Map<string, WordProgress[]>()
  for (const wp of snapshot.wordProgress) {
    const list = byPack.get(wp.packageId)
    if (list) list.push(wp)
    else byPack.set(wp.packageId, [wp])
  }

  for (const pack of packs) {
    const words = byPack.get(pack.id) ?? []
    const known = snapshot.knownMap.get(pack.id) ?? 0
    const progress = snapshot.progressMap.get(pack.id)
    const everHeld = pack.wordCount > 0 && known >= pack.wordCount
    const strength = packStrength(words, today)

    const relation: PackRelation =
      everHeld
        ? (strength < FADING_RETRIEVABILITY ? 'fading' : 'held')
        : (progress != null || known > 0 ? 'active' : 'ahead')

    out.set(pack.id, { relation, strength, known, total: pack.wordCount, everHeld })
  }
  return out
}

/** Packs that were conquered and are now slipping — newest decay first. */
export function fadingPacks(memory: Map<string, PackMemory>): string[] {
  return [...memory.entries()]
    .filter(([, m]) => m.relation === 'fading')
    .sort((a, b) => a[1].strength - b[1].strength)
    .map(([id]) => id)
}
