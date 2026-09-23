import packagesIndex from './packages-index.json'
import { PackMeta } from '../types/vocabulary'

/**
 * The catalogue, and an id → position map built once for it.
 *
 * Every screen already imported `packages-index.json` and wrote its own
 * `allPacks.find(p => p.id === packageId)`. With 834 packs that is a linear
 * scan, and the screens doing it most — the session pages — re-render on every
 * card flip, so the scan ran again each time (twice on the ones that also want
 * the neighbour: a `find` and a `findIndex` over the same array).
 *
 * None of it is memoised at the call sites, and none of it needs to be: the
 * catalogue is a static import that never changes for the life of the tab, so
 * the map is built once at module load and every lookup after that is O(1).
 *
 * `packAt` is deliberately index-based rather than returning neighbours
 * directly — the callers want different things from the position (next, prev,
 * "is this the last one"), and the position is what they all share.
 */
export const allPacks = packagesIndex as PackMeta[]

const indexById = new Map<string, number>(allPacks.map((p, i) => [p.id, i]))

/** The pack's position in the route, or -1 — same contract as `findIndex`. */
export function packIndexById(id: string | null | undefined): number {
  if (id == null) return -1
  return indexById.get(id) ?? -1
}

/** The pack with this id, or undefined — same contract as `find`. */
export function packById(id: string | null | undefined): PackMeta | undefined {
  const i = packIndexById(id)
  return i < 0 ? undefined : allPacks[i]
}

/** The pack at an offset from this one, or null at either end of the route. */
export function packAt(id: string | null | undefined, offset: number): PackMeta | null {
  const i = packIndexById(id)
  if (i < 0) return null
  return allPacks[i + offset] ?? null
}
