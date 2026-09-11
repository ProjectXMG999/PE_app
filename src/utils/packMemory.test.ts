import { describe, it, expect } from 'vitest'
import { buildPackMemory, fadingPacks, sealedPacks } from './packMemory'
import { PackMeta } from '../types/vocabulary'
import { WordProgress, PackageProgress } from '../types/progress'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { RETIRE_STABILITY_DAYS, BULK_KNOWN_STABILITY } from '../services/reviewConfig'
import { dayKey, shiftDay } from './day'

const PACK: PackMeta = {
  id: 'p1', name: 'Pack', volume: 'Tom I', level: 1,
  category: 'Czasowniki', wordCount: 3, chapter: 'Rozdział I',
}

function word(over: Partial<WordProgress> = {}): WordProgress {
  return {
    wordId: `${PACK.id}-${Math.random()}`,
    packageId: PACK.id,
    seenCount: 1,
    lastSeen: new Date().toISOString(),
    status: 'known',
    ...over,
  }
}

/** A snapshot carrying only what buildPackMemory reads. */
function snap(words: WordProgress[], progress?: Partial<PackageProgress>): ProgressSnapshot {
  const known = words.filter(w => w.status === 'known').length
  return {
    wordProgress: words,
    knownMap: new Map([[PACK.id, known]]),
    progressMap: progress
      ? new Map([[PACK.id, {
          packageId: PACK.id, startedAt: '', completedAt: null, masteredAt: null,
          currentIndex: 0, ...progress,
        }]])
      : new Map(),
  } as unknown as ProgressSnapshot
}

const daysAgo = (n: number) => new Date(`${shiftDay(-n, dayKey())}T12:00:00.000Z`).toISOString()

describe('buildPackMemory', () => {
  it('marks an untouched pack as ahead', () => {
    const m = buildPackMemory([PACK], snap([]))
    expect(m.get('p1')!.relation).toBe('ahead')
  })

  it('marks a partially-known pack as active', () => {
    const m = buildPackMemory([PACK], snap([word({ stability: 10, lastSeen: daysAgo(1) })]))
    expect(m.get('p1')!.relation).toBe('active')
  })

  it('marks a fully-known, freshly-reviewed pack as held', () => {
    const words = Array.from({ length: 3 }, () => word({ stability: 40, lastSeen: daysAgo(1) }))
    const m = buildPackMemory([PACK], snap(words))
    expect(m.get('p1')!.relation).toBe('held')
    expect(m.get('p1')!.everHeld).toBe(true)
  })

  it('marks a decayed pack as fading — but never drops everHeld', () => {
    // Low stability, long since seen → retrievability well under the threshold.
    const words = Array.from({ length: 3 }, () => word({ stability: 2, lastSeen: daysAgo(60) }))
    const m = buildPackMemory([PACK], snap(words))
    const mem = m.get('p1')!
    expect(mem.relation).toBe('fading')
    expect(mem.everHeld).toBe(true)
    expect(mem.strength).toBeLessThan(0.7)
    expect(fadingPacks(m)).toEqual(['p1'])
  })

  it('marks a pack out of the review queue as sealed', () => {
    const words = Array.from({ length: 3 }, () => word({
      stability: RETIRE_STABILITY_DAYS + 10,
      retiredAt: daysAgo(5),
      reviewCount: 6,
      lastSeen: daysAgo(5),
    }))
    const m = buildPackMemory([PACK], snap(words))
    expect(m.get('p1')!.relation).toBe('sealed')
    expect(m.get('p1')!.retired).toBe(3)
    expect(sealedPacks(m)).toEqual(['p1'])
  })

  it('does not seal a pack where only some words retired', () => {
    const words = [
      word({ stability: RETIRE_STABILITY_DAYS + 10, retiredAt: daysAgo(5), lastSeen: daysAgo(5) }),
      word({ stability: 40, lastSeen: daysAgo(1) }),
      word({ stability: 40, lastSeen: daysAgo(1) }),
    ]
    const m = buildPackMemory([PACK], snap(words))
    expect(m.get('p1')!.relation).toBe('held')
    expect(m.get('p1')!.retired).toBe(1)
  })

  it('counts bulk-marked words as claimed, and does NOT seal them', () => {
    // What applyKnown({bulk:true}) writes: an asserted stability, reviewCount 0.
    const words = Array.from({ length: 3 }, () => word({
      stability: BULK_KNOWN_STABILITY,
      difficulty: 4.5,
      reviewCount: 0,
      lastSeen: daysAgo(1),
    }))
    const m = buildPackMemory([PACK], snap(words, { masteredAt: daysAgo(1) }))
    const mem = m.get('p1')!
    expect(mem.claimed).toBe(3)
    expect(mem.retired).toBe(0)
    // "Znam wszystko" is a claim the scheduler still intends to verify — it must
    // not read as the top of the ladder.
    expect(mem.relation).toBe('held')
    expect(sealedPacks(m)).toEqual([])
  })

  it('treats words with no FSRS state as held rather than fading', () => {
    const words = Array.from({ length: 3 }, () => word({ lastSeen: daysAgo(300) }))
    expect(buildPackMemory([PACK], snap(words)).get('p1')!.relation).toBe('held')
  })

  it('returns ahead for every pack when there is no snapshot yet', () => {
    const m = buildPackMemory([PACK], null)
    expect(m.get('p1')).toMatchObject({ relation: 'ahead', known: 0, retired: 0, claimed: 0 })
  })
})
