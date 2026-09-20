import { describe, it, expect } from 'vitest'
import { nextListenPack, listenedPacksCount, listenBacklogCount } from './nextPack'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'

const packs: PackMeta[] = [1, 2, 3, 4].map(n => ({
  id: `p${n}`, name: `Pakiet ${n}`, volume: 'v1', level: 1, category: 'c', wordCount: 10, chapter: 'ch1',
}))

function pkg(over: Partial<PackageProgress> = {}): PackageProgress {
  return {
    packageId: 'p1', startedAt: '2026-05-01T00:00:00Z',
    completedAt: null, masteredAt: null, listenedAt: null, currentIndex: 0,
    ...over,
  }
}

function snap(rows: Array<[string, PackageProgress]>): ProgressSnapshot {
  return { progressMap: new Map(rows), knownMap: new Map() } as ProgressSnapshot
}

/* These used to read `currentIndex >= wordCount`, which a Trenuj run, a
   "Znam wszystko" tap and a level declaration all satisfied — so declaring a
   level known reported the whole level as listened through. */
describe('listenedPacksCount', () => {
  it('counts only packs with a real play-through on record', () => {
    const s = snap([
      ['p1', pkg({ listenedAt: '2026-05-02T00:00:00Z' })],
      // Mastered and worked through, but never played: not listened.
      ['p2', pkg({ masteredAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:00:00Z' })],
      // A pointer without a play-through is a run in progress, not a finish.
      ['p3', pkg({ currentIndex: 10 })],
    ])
    expect(listenedPacksCount(packs, s)).toBe(1)
  })

  it('is zero without a snapshot', () => {
    expect(listenedPacksCount(packs, null)).toBe(0)
  })
})

describe('nextListenPack', () => {
  it('picks the first pack with no play-through, resuming where playback stopped', () => {
    const s = snap([
      ['p1', pkg({ listenedAt: '2026-05-02T00:00:00Z' })],
      ['p2', pkg({ currentIndex: 4 })],
    ])
    expect(nextListenPack(packs, s)).toMatchObject({ pack: packs[1], startIndex: 4 })
  })

  it('does not skip a pack just because it is mastered', () => {
    const s = snap([['p1', pkg({ masteredAt: '2026-05-02T00:00:00Z' })]])
    expect(nextListenPack(packs, s)?.pack).toBe(packs[0])
  })

  it('clamps a stale pointer so the pack never opens past its last card', () => {
    const s = snap([['p1', pkg({ currentIndex: 10 })]])
    expect(nextListenPack(packs, s)).toMatchObject({ pack: packs[0], startIndex: 9 })
  })

  it('returns null once every pack has been played through', () => {
    const s = snap(packs.map(p => [p.id, pkg({ listenedAt: '2026-05-02T00:00:00Z' })] as [string, PackageProgress]))
    expect(nextListenPack(packs, s)).toBeNull()
  })
})

describe('listenBacklogCount', () => {
  it('counts the unlistened packs left behind the frontier', () => {
    const s = snap([['p2', pkg({ listenedAt: '2026-05-02T00:00:00Z' })]])
    // Frontier at p4: p1 and p3 are behind it and unheard, p2 was heard.
    expect(listenBacklogCount(packs, s, packs[3])).toBe(2)
  })

  it('is zero when the frontier is the first pack — nothing is behind it', () => {
    expect(listenBacklogCount(packs, snap([]), packs[0])).toBe(0)
  })

  it('is zero without a frontier', () => {
    expect(listenBacklogCount(packs, snap([]), null)).toBe(0)
  })
})
