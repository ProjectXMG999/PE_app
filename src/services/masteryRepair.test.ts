import { describe, it, expect } from 'vitest'
import { planMasteryRepair, knownCountByPack } from './masteryRepair'
import { PackageProgress, WordProgress } from '../types/progress'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

// Two real packs, so the plan is measured against the shipped word counts
// rather than a number invented by the test.
const [SMALL, OTHER] = (packagesIndex as PackMeta[]).filter(p => p.wordCount > 0).slice(0, 2)

const NOW = '2026-09-21T12:00:00.000Z'

function pack(over: Partial<PackageProgress> = {}): PackageProgress {
  return {
    packageId: SMALL.id, startedAt: '2026-01-01T00:00:00.000Z', completedAt: null,
    masteredAt: null, listenedAt: null, currentIndex: 0, ...over,
  }
}

function known(packageId: string, n: number): WordProgress[] {
  return Array.from({ length: n }, (_, i) => ({
    wordId: `${packageId}-${String(i + 1).padStart(3, '0')}`,
    packageId, seenCount: 1, lastSeen: NOW, status: 'known' as const,
  }))
}

describe('knownCountByPack', () => {
  it('counts only words that are actually known', () => {
    const words: WordProgress[] = [
      ...known(SMALL.id, 2),
      { wordId: 'x', packageId: SMALL.id, seenCount: 1, lastSeen: NOW, status: 'learning' },
    ]
    expect(knownCountByPack(words).get(SMALL.id)).toBe(2)
  })
})

describe('planMasteryRepair — clearing', () => {
  it('clears masteredAt on a pack whose words are not all known', () => {
    const plan = planMasteryRepair([pack({ masteredAt: NOW })], new Map([[SMALL.id, 1]]), NOW)
    expect(plan.cleared.map(p => p.packageId)).toEqual([SMALL.id])
    expect(plan.cleared[0].masteredAt).toBeNull()
  })

  it('leaves a genuinely mastered pack alone', () => {
    const plan = planMasteryRepair([pack({ masteredAt: NOW })], new Map([[SMALL.id, SMALL.wordCount]]), NOW)
    expect(plan.cleared).toEqual([])
    expect(plan.promoted).toEqual([])
  })

  it('leaves packs that are no longer in the catalogue alone', () => {
    const plan = planMasteryRepair([pack({ packageId: 't1-p000-gone', masteredAt: NOW })], new Map(), NOW)
    expect(plan.cleared).toEqual([])
  })
})

describe('planMasteryRepair — promoting', () => {
  it('sets masteredAt on a fully known pack whose flag was never written', () => {
    const plan = planMasteryRepair(
      [pack({ completedAt: '2026-05-05T00:00:00.000Z' })],
      new Map([[SMALL.id, SMALL.wordCount]]),
      NOW,
    )
    expect(plan.promoted).toHaveLength(1)
    // Dated to the run that finished the pack, not to the repair.
    expect(plan.promoted[0].masteredAt).toBe('2026-05-05T00:00:00.000Z')
  })

  it('promotes a pack finished in cross-pack sessions, with no PackageProgress row at all', () => {
    // /powtorka and Inteligentny write word progress for packs that were never
    // opened on their own. Keyed off existing package rows, this pack could
    // never be promoted: the route counted it 15/15, the pack page showed no
    // star, and nothing could ever reconcile the two.
    const plan = planMasteryRepair([], new Map([[OTHER.id, OTHER.wordCount]]), NOW)
    expect(plan.promoted.map(p => p.packageId)).toEqual([OTHER.id])
    expect(plan.promoted[0].masteredAt).toBe(NOW)
    expect(plan.promoted[0].startedAt).toBe(NOW)
  })

  it('never raises currentIndex — knowing every word is not having heard them', () => {
    const plan = planMasteryRepair(
      [pack({ currentIndex: 3, listenedAt: null })],
      new Map([[SMALL.id, SMALL.wordCount]]),
      NOW,
    )
    expect(plan.promoted[0].currentIndex).toBe(3)
    expect(plan.promoted[0].listenedAt).toBeNull()
  })

  it('leaves a partially known pack unpromoted', () => {
    const plan = planMasteryRepair([pack()], new Map([[SMALL.id, SMALL.wordCount - 1]]), NOW)
    expect(plan.promoted).toEqual([])
  })

  it('is idempotent — a plan applied once finds nothing the second time', () => {
    const first = planMasteryRepair([pack()], new Map([[SMALL.id, SMALL.wordCount]]), NOW)
    const second = planMasteryRepair(first.promoted, new Map([[SMALL.id, SMALL.wordCount]]), NOW)
    expect(second.cleared).toEqual([])
    expect(second.promoted).toEqual([])
  })
})
