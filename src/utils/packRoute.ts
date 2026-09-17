import { PackMeta } from '../types/vocabulary'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { PackStatus } from './packVisuals'
import { PackMemory } from './packMemory'

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

export interface LevelGroup {
  level: number
  volumes: VolumeGroup[]
  packs: PackMeta[]
  firstNum: number
  lastNum: number
}

/**
 * The volume's level: whichever level most of its packs carry.
 *
 * Volumes are not level-pure — Tom III is 61 packs of level 2 and 38 of level 3
 * — so something has to decide. Taking the majority is what keeps the route
 * intact: volumes are contiguous in curriculum order, so grouping *volumes*
 * under levels never reorders a single pack. Grouping the packs themselves by
 * level would, because `level` dips backwards 8 times along the route (e.g. two
 * level-1 packs sit inside Tom VII), and those stragglers would be yanked
 * hundreds of positions out of place.
 */
export function volumeLevel(group: VolumeGroup): number {
  const counts = new Map<number, number>()
  for (const p of group.packs) counts.set(p.level, (counts.get(p.level) ?? 0) + 1)
  let best = group.packs[0]?.level ?? 1
  let bestN = -1
  for (const [level, n] of counts) {
    if (n > bestN) { best = level; bestN = n }
  }
  return best
}

/**
 * Level → its volumes → its packs, all still in route order.
 *
 * On this catalogue it comes out clean: L1 = Tom I, L2 = Tom II–III,
 * L3 = Tom IV–V, L4 = Tom VI–IX. Four chapters, nine volumes, nothing moved.
 */
export function groupByLevel(packs: PackMeta[]): LevelGroup[] {
  const out: LevelGroup[] = []
  for (const vol of groupByVolume(packs)) {
    const level = volumeLevel(vol)
    const last = out[out.length - 1]
    if (last && last.level === level) {
      last.volumes.push(vol)
      last.packs = last.packs.concat(vol.packs)
      last.lastNum = vol.lastNum
    } else {
      out.push({ level, volumes: [vol], packs: [...vol.packs], firstNum: vol.firstNum, lastNum: vol.lastNum })
    }
  }
  return out
}

/**
 * Known-word / done-pack totals for a volume, for the section header ring.
 *
 * `done` used to come from `getStatus()`, which trusts `PackageProgress`'s
 * `completedAt`/`masteredAt` flags — and those flags are documented elsewhere
 * in this codebase (`masteryRepair.ts`, `PackageCard`'s old defensive check)
 * as going stale: a pack can carry `masteredAt` from before a lapse, or a
 * `completedAt` from Słuchaj that says nothing about whether the words are
 * actually known. That mismatch is exactly what let a volume header say
 * "ukończony" while its own knowledge meter sat at 41% two rows down — one
 * number came from the honest `knownMap` count, the other from a flag that
 * doesn't track it. `done` now uses the same real count `pct` already does
 * (mirrors `everHeld` in packMemory.ts), so the two numbers can't disagree.
 */
export function volumeStats(group: VolumeGroup, snapshot: ProgressSnapshot | null): VolumeStats {
  let total = 0
  let known = 0
  let done = 0
  for (const p of group.packs) {
    total += p.wordCount
    if (snapshot) {
      const packKnown = snapshot.knownMap.get(p.id) ?? 0
      known += packKnown
      if (p.wordCount > 0 && packKnown >= p.wordCount) done++
    }
  }
  return { total, known, done, packs: group.packs.length, pct: total > 0 ? (known / total) * 100 : 0 }
}

/** Same totals for a whole level — `VolumeStats` shape, so headers share code. */
export function levelStats(group: LevelGroup, snapshot: ProgressSnapshot | null): VolumeStats {
  return volumeStats(
    { volume: '', short: '', packs: group.packs, firstNum: group.firstNum, lastNum: group.lastNum, levels: [group.level] },
    snapshot,
  )
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

/**
 * The lenses the route can be looked at through.
 *
 * Deliberately *diagnoses*, not sort orders (goal E3). Two of them —
 * `fading` and `sealing` — are facts about your memory rather than about your
 * progress bar, and neither existed as a filter before: `fadingPacks()` was
 * computed and reduced to a count, and the retirement threshold was only ever
 * a state, never something you could go and look at.
 *
 * Note what is NOT here: nothing that turns into "do this now". A lens shows
 * you territory; acting on it is Dzisiaj's job.
 */
export type PackLens = 'all' | 'fading' | 'sealing' | 'started' | 'mastered' | 'new'

export const PACK_LENSES: PackLens[] = ['all', 'fading', 'sealing', 'started', 'mastered', 'new']

export const LENS_LABEL: Record<PackLens, string> = {
  all: 'Wszystkie',
  fading: 'Wraca do Ciebie',
  sealing: 'Blisko „Na stałe"',
  started: 'W toku',
  mastered: 'Opanowane',
  new: 'Nowe',
}

/**
 * What the route is being looked at through.
 *
 * There is deliberately no `level` here any more. The level filter used to
 * match `pack.level` — a difficulty tag that is not monotonic along the route —
 * while the level switcher groups whole volumes by majority level, so the two
 * disagreed: "Everyday" as a filter returned packs from volumes the switcher
 * files under Freedom. The switcher is now the only way to pick a level.
 */
export interface PackFilters {
  query: string
  cat: string | null
  lens: PackLens
}

export const EMPTY_FILTERS: PackFilters = { query: '', cat: null, lens: 'all' }

/** A bare number (optionally `#`-prefixed) in the search box addresses a pack
 *  directly rather than filtering by text — see `isJumpQuery`. */
const JUMP_QUERY_RE = /^#?\s*(\d{1,4})$/

/** True when the query is a "go to pack N" shortcut rather than a text search. */
export function isJumpQuery(query: string): boolean {
  return JUMP_QUERY_RE.test(query.trim())
}

/**
 * A text search is on — the one case that leaves the route for a flat list.
 *
 * Search means "find it wherever it is", so results span every volume. A query
 * that's purely a route number is excluded: it means "take me there", not
 * "filter the route down to this" (typing "317" used to drop into an empty
 * result list instead of offering the jump).
 */
export function isSearching(f: PackFilters): boolean {
  return f.query.trim() !== '' && !isJumpQuery(f.query)
}

/**
 * A state lens or a category is on. These narrow the route *in place*: levels
 * and volumes stay, and each shows how many of its packs match — the filter
 * answers "where are my in-progress packs", not just "which".
 */
export function isFilteringRoute(f: PackFilters): boolean {
  return f.lens !== 'all' || f.cat != null
}

/** Any narrowing at all — search or an in-route filter. */
export function filtersActive(f: PackFilters): boolean {
  return isSearching(f) || isFilteringRoute(f)
}

/** Does a pack pass the in-route filters (lens + category, not the query)? */
export function packMatchesRouteFilter(pack: PackMeta, f: PackFilters, ctx: LensContext): boolean {
  return (f.cat == null || pack.category === f.cat) && packMatchesLens(pack, f.lens, ctx)
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

/** Everything a lens needs to judge one pack, gathered once by the caller. */
export interface LensContext {
  snapshot: ProgressSnapshot | null
  memory: Map<string, PackMemory>
  /** packId → words one review from retiring (`nearlySealedByPack`). */
  sealing: Map<string, number>
}

/**
 * Does this pack show through that lens?
 *
 * `mastered` deliberately includes `sealed`: a pack that has left the review
 * queue is still mastered, and the reward rule is that nothing ever un-earns.
 * `sealing` deliberately excludes packs already sealed — an opportunity you
 * have taken is no longer an opportunity.
 */
export function packMatchesLens(pack: PackMeta, lens: PackLens, ctx: LensContext): boolean {
  if (lens === 'all') return true
  const mem = ctx.memory.get(pack.id)
  switch (lens) {
    case 'fading':   return mem?.relation === 'fading'
    case 'sealing':  return mem?.relation !== 'sealed' && (ctx.sealing.get(pack.id) ?? 0) > 0
    case 'mastered': return mem?.relation === 'held' || mem?.relation === 'sealed'
    case 'started':  return mem?.relation === 'active'
    case 'new':      return mem?.relation === 'ahead'
    default:         return true
  }
}

/** How many packs each lens would show — the numbers on the lens chips. */
export function lensCounts(packs: PackMeta[], ctx: LensContext): Record<PackLens, number> {
  const out = { all: packs.length, fading: 0, sealing: 0, started: 0, mastered: 0, new: 0 }
  for (const pack of packs) {
    for (const lens of PACK_LENSES) {
      if (lens !== 'all' && packMatchesLens(pack, lens, ctx)) out[lens]++
    }
  }
  return out
}

export interface FacetCounts {
  lens: Record<PackLens, number>
  category: Record<string, number>
}

/**
 * Counts for each tab of the filter sheet, each computed with the *other*
 * facet already applied — standard faceted search. Tallying every tab against
 * the full catalogue regardless of the other selection produced numbers a user
 * could prove wrong at a glance, which is the fastest way to make a filter feel
 * broken even when the packs it returns are correct.
 *
 * The free-text query applies to both, since it isn't a tab of its own. A jump
 * query ("317") is excluded, same reasoning as `isSearching`.
 */
export function facetCounts(packs: PackMeta[], filters: PackFilters, ctx: LensContext): FacetCounts {
  const queryIds = isSearching(filters)
    ? new Set(filterPacksByQuery(packs, filters.query).map(p => p.id))
    : null

  const matches = (p: PackMeta, skip: 'cat' | 'lens'): boolean =>
    (skip === 'cat' || filters.cat == null || p.category === filters.cat) &&
    (skip === 'lens' || packMatchesLens(p, filters.lens, ctx)) &&
    (queryIds == null || queryIds.has(p.id))

  const lens = { all: 0, fading: 0, sealing: 0, started: 0, mastered: 0, new: 0 }
  const category: Record<string, number> = {}

  for (const p of packs) {
    if (matches(p, 'lens')) {
      lens.all++
      for (const l of PACK_LENSES) if (l !== 'all' && packMatchesLens(p, l, ctx)) lens[l]++
    }
    if (matches(p, 'cat')) category[p.category] = (category[p.category] ?? 0) + 1
  }

  return { lens, category }
}

/**
 * How many packs pass the in-route filters in each volume — the numbers on the
 * volume chips and level segments while a filter is on. Only volumes with at
 * least one match are present.
 */
export function routeFilterCounts(
  packs: PackMeta[],
  filters: PackFilters,
  ctx: LensContext,
): Map<string, number> {
  const out = new Map<string, number>()
  if (!isFilteringRoute(filters)) return out
  for (const p of packs) {
    if (packMatchesRouteFilter(p, filters, ctx)) out.set(p.volume, (out.get(p.volume) ?? 0) + 1)
  }
  return out
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
