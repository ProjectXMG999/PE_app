import { PackMeta } from '../types/vocabulary'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { getStatus, PackStatus } from './packVisuals'

/**
 * The Pakiety page is the *map* of the 10 000-word route. `packages-index.json`
 * is already in route order (the global `#NNN` in each id runs 1…865 across
 * every volume), so the file order IS the curriculum — never re-sort it.
 *
 * The visible milestone unit is the **volume** ("Tom I"…"Tom IX"): volumes are
 * contiguous in file order, ~100 packs each. `pack.level` (1–4) is a difficulty
 * tag that is NOT monotonic along the route, so it stays a filter lens, not a
 * grouping key.
 */

export interface VolumeGroup {
  /** Raw label, e.g. "Tom I". */
  volume: string
  /** Just the roman numeral, e.g. "I". */
  short: string
  packs: PackMeta[]
  /** Global route number of the first / last pack in the volume. */
  firstNum: number
  lastNum: number
  /** Distinct difficulty levels present in the volume, ascending. */
  levels: number[]
}

export interface VolumeStats {
  total: number
  known: number
  /** Packs that are completed or mastered. */
  done: number
  packs: number
  pct: number
}

const NUM_RE = /p0*(\d+)$/

/** Global route number from a pack id ("t1-p606" → 606). */
export function routeNumber(id: string): number {
  const m = id.match(NUM_RE)
  return m ? parseInt(m[1], 10) : 0
}

/** "Tom I" → "I". Falls back to the whole label if it doesn't match. */
export function volumeShort(volume: string): string {
  return volume.replace(/^Tom\s+/i, '').trim() || volume
}

/** Volume labels in the order they first appear along the route. */
export function volumeOrder(packs: PackMeta[]): string[] {
  const seen: string[] = []
  for (const p of packs) if (!seen.includes(p.volume)) seen.push(p.volume)
  return seen
}

/** Group packs by volume, preserving route order within and between groups. */
export function groupByVolume(packs: PackMeta[]): VolumeGroup[] {
  const order = volumeOrder(packs)
  return order.map(volume => {
    const vp = packs.filter(p => p.volume === volume)
    return {
      volume,
      short: volumeShort(volume),
      packs: vp,
      firstNum: routeNumber(vp[0]?.id ?? ''),
      lastNum: routeNumber(vp[vp.length - 1]?.id ?? ''),
      levels: Array.from(new Set(vp.map(p => p.level))).sort((a, b) => a - b),
    }
  })
}

/** Known-word / done-pack totals for a volume, for the section header ring. */
export function volumeStats(group: VolumeGroup, snapshot: ProgressSnapshot | null): VolumeStats {
  let total = 0
  let known = 0
  let done = 0
  for (const p of group.packs) {
    total += p.wordCount
    if (snapshot) {
      known += snapshot.knownMap.get(p.id) ?? 0
      const st = getStatus(snapshot.progressMap.get(p.id))
      if (st === 'completed' || st === 'mastered') done++
    }
  }
  return { total, known, done, packs: group.packs.length, pct: total > 0 ? (known / total) * 100 : 0 }
}

/**
 * The frontier: the earliest pack on the route that isn't fully mastered — the
 * one the map should point at and expand by default. Returns null once every
 * pack is mastered.
 */
export function frontierPack(packs: PackMeta[], snapshot: ProgressSnapshot | null): PackMeta | null {
  if (packs.length === 0) return null
  if (!snapshot) return packs[0]
  for (const pack of packs) {
    const known = snapshot.knownMap.get(pack.id) ?? 0
    if (known < pack.wordCount) return pack
  }
  return null
}

export type PackStatusFilter = PackStatus | 'all'

/** The four lenses the map can be viewed through. All-null = the full route. */
export interface PackFilters {
  query: string
  level: number | null
  cat: string | null
  status: PackStatusFilter
}

export const EMPTY_FILTERS: PackFilters = { query: '', level: null, cat: null, status: 'all' }

/** True when any lens is engaged — the list then drops to a flat filtered view. */
export function filtersActive(f: PackFilters): boolean {
  return f.query.trim() !== '' || f.level != null || f.cat != null || f.status !== 'all'
}

/** Per-pack status filter shared by the flat (filtered) list view. */
export function packMatchesStatus(
  pack: PackMeta,
  snapshot: ProgressSnapshot | null,
  status: PackStatus | 'all',
): boolean {
  if (status === 'all') return true
  const prog = snapshot?.progressMap.get(pack.id)
  const known = snapshot?.knownMap.get(pack.id) ?? 0
  const allKnown = known >= pack.wordCount && pack.wordCount > 0
  switch (status) {
    case 'new':       return prog == null
    case 'started':   return prog != null && prog.completedAt == null && !allKnown
    case 'completed': return prog?.completedAt != null && !allKnown
    case 'mastered':  return allKnown
    default:          return true
  }
}

/**
 * Cheap fuzzy score: every query char must appear in order in the text.
 * Contiguous runs and word-start hits score higher. Returns -1 for no match.
 * Good enough for filtering 864 short pack names without a dependency.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) return 0
  if (t.includes(q)) return 1000 - (t.indexOf(q) + (t.length - q.length))
  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) return -1
    if (found === ti) { streak++; score += 5 + streak } else { streak = 0; score += 1 }
    if (found === 0 || /\s/.test(t[found - 1] ?? '')) score += 3
    ti = found + 1
  }
  return score
}

/** Packs matching a free-text query (name or category), best matches first. */
export function filterPacksByQuery(packs: PackMeta[], query: string): PackMeta[] {
  const q = query.trim()
  if (!q) return packs
  const scored: { pack: PackMeta; score: number; idx: number }[] = []
  packs.forEach((pack, idx) => {
    const s = Math.max(fuzzyScore(q, pack.name), fuzzyScore(q, pack.category) - 4)
    if (s >= 0) scored.push({ pack, score: s, idx })
  })
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.map(s => s.pack)
}
