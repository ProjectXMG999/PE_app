import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  packageIdsForLevel, applyLevelMasteryToWord, packageProgressForLevelMastery,
  markLevelMastered, LevelMasteryFetchError,
} from './levelMastery'
import type { WordProgress, PackageProgress } from '../types/progress'

/* The pack fetch and the database, stubbed — what's under test here is what
   markLevelMastered does when a pack DOESN'T arrive. It used to reject with
   the first fetch's error and no retry at all, which the UI then swallowed
   whole: one dropped request out of 335 and the whole declaration vanished
   without a word. */
const { fetchImpl, saveSpy } = vi.hoisted(() => ({
  fetchImpl: vi.fn(),
  saveSpy: vi.fn(),
}))

vi.mock('../hooks/usePackageData', () => {
  class PackFetchError extends Error {
    constructor(public readonly packId: string, public readonly status: number) {
      super(`Pack ${packId}: HTTP ${status}`)
      this.name = 'PackFetchError'
    }
  }
  return { PackFetchError, fetchPack: (id: string) => fetchImpl(id) }
})

vi.mock('./db', () => ({
  getAllWordProgress: async () => [],
  getAllPackageProgress: async () => [],
  saveLevelMastery: (...args: unknown[]) => { saveSpy(...args); return Promise.resolve() },
  undoLevelMastery: vi.fn(),
  getLevelMasterySnapshot: vi.fn(),
}))

const today = new Date('2026-06-01T12:00:00Z')

describe('markLevelMastered when packs fail to load', () => {
  const pack = (id: string) => ({ id, words: [{ id: `${id}-w1` }] })

  beforeEach(() => {
    fetchImpl.mockReset()
    saveSpy.mockReset()
  })

  it('retries a pack that failed on a transient error, and still lands', async () => {
    let flaky = 0
    fetchImpl.mockImplementation(async (id: string) => {
      if (id === 't1-p003' && flaky++ === 0) throw new TypeError('Failed to fetch')
      return pack(id)
    })

    await markLevelMastered(1)

    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(flaky).toBe(2) // failed once, retried once
  })

  it('a settled refusal is not retried, and nothing is written', async () => {
    const { PackFetchError } = await import('../hooks/usePackageData')
    fetchImpl.mockImplementation(async (id: string) => {
      if (id === 't1-p003') throw new PackFetchError(id, 402)
      return pack(id)
    })

    const err = await markLevelMastered(1).catch(e => e)

    expect(err).toBeInstanceOf(LevelMasteryFetchError)
    expect(err.failed).toEqual(['t1-p003'])
    expect(err.total).toBe(109)
    expect(err.status).toBe(402)
    // One attempt only — a 402 doesn't become a 200 by asking again.
    expect(fetchImpl.mock.calls.filter(([id]) => id === 't1-p003')).toHaveLength(1)
    // And above all: a level is never left half-declared.
    expect(saveSpy).not.toHaveBeenCalled()
  })
})

describe('packageIdsForLevel', () => {
  it('matches the current catalog\'s per-level pack counts', () => {
    expect(packageIdsForLevel(1)).toHaveLength(109)
    expect(packageIdsForLevel(2)).toHaveLength(156)
    expect(packageIdsForLevel(3)).toHaveLength(234)
    expect(packageIdsForLevel(4)).toHaveLength(335)
  })

  it('returns only ids for that level', () => {
    expect(packageIdsForLevel(1).every(id => id.startsWith('t1-p'))).toBe(true)
  })
})

describe('applyLevelMasteryToWord', () => {
  it('a word with no prior progress becomes a fresh declared-known-and-retired record', () => {
    const wp = applyLevelMasteryToWord(undefined, 'w1', 'p1', today)
    expect(wp.status).toBe('known')
    expect(wp.retiredAt).toBe(today.toISOString())
    expect(wp.nextReviewAt).toBeUndefined()
    expect(wp.declaredKnownAt).toBe(today.toISOString())
    expect(wp.declaredRetiredAt).toBe(today.toISOString())
    expect(wp.reviewCount ?? 0).toBe(0)
  })

  it('a word with REAL progress keeps its earned history untouched, only pulled out of rotation', () => {
    const existing: WordProgress = {
      wordId: 'w1', packageId: 'p1', seenCount: 6, lastSeen: '2026-05-20T00:00:00Z',
      status: 'known', reviewCount: 5, stability: 8, difficulty: 5.5,
      nextReviewAt: '2026-06-10',
    }
    const wp = applyLevelMasteryToWord(existing, 'w1', 'p1', today)
    expect(wp.reviewCount).toBe(5)
    expect(wp.stability).toBe(8)
    expect(wp.difficulty).toBe(5.5)
    expect(wp.seenCount).toBe(6)
    expect(wp.declaredKnownAt).toBeUndefined() // never a declaration — genuinely known
    // ...but still fully pulled out of the review queue, permanently.
    expect(wp.retiredAt).toBe(today.toISOString())
    expect(wp.nextReviewAt).toBeUndefined()
    expect(wp.declaredRetiredAt).toBe(today.toISOString())
  })

  it('a word already known ONLY via an earlier declaration is treated as undeclared history, not real progress', () => {
    const existing: WordProgress = {
      wordId: 'w1', packageId: 'p1', seenCount: 1, lastSeen: '2026-05-01T00:00:00Z',
      status: 'known', reviewCount: 0, stability: 15, difficulty: 4.5,
      declaredKnownAt: '2026-05-01T00:00:00Z', nextReviewAt: '2026-05-15',
    }
    const wp = applyLevelMasteryToWord(existing, 'w1', 'p1', today)
    // declaredKnownAt is preserved (first declaration date), not bumped to `today`.
    expect(wp.declaredKnownAt).toBe('2026-05-01T00:00:00Z')
    expect(wp.declaredRetiredAt).toBe(today.toISOString())
    expect(wp.retiredAt).toBe(today.toISOString())
    expect(wp.nextReviewAt).toBeUndefined()
  })

  it('re-marking an already level-mastered word preserves its original declaredRetiredAt', () => {
    const existing: WordProgress = {
      wordId: 'w1', packageId: 'p1', seenCount: 1, lastSeen: '2026-05-01T00:00:00Z',
      status: 'known', reviewCount: 0, retiredAt: '2026-05-02T00:00:00Z',
      declaredKnownAt: '2026-05-01T00:00:00Z', declaredRetiredAt: '2026-05-02T00:00:00Z',
    }
    const wp = applyLevelMasteryToWord(existing, 'w1', 'p1', today)
    expect(wp.declaredRetiredAt).toBe('2026-05-02T00:00:00Z')
  })
})

/* The pack half of the declaration. This used to write the full word count
   into the listen pointer, which is how "Oznacz poziom jako opanowany" made
   every pack of the level read "✓ Odsłuchana" without a second of audio. */
describe('packageProgressForLevelMastery', () => {
  const nowIso = today.toISOString()

  it('claims knowledge and says nothing about listening', () => {
    const pp = packageProgressForLevelMastery(undefined, 'p1', nowIso)
    expect(pp.masteredAt).toBe(nowIso)
    expect(pp.completedAt).toBe(nowIso)
    expect(pp.listenedAt).toBeNull()
    expect(pp.currentIndex).toBe(0)
  })

  it('leaves a real listen position and date exactly as they were', () => {
    const existing: PackageProgress = {
      packageId: 'p1', startedAt: '2026-04-01T00:00:00Z',
      completedAt: null, masteredAt: null,
      listenedAt: '2026-05-10T00:00:00Z', currentIndex: 12,
    }
    const pp = packageProgressForLevelMastery(existing, 'p1', nowIso)
    expect(pp.listenedAt).toBe('2026-05-10T00:00:00Z')
    expect(pp.currentIndex).toBe(12)
    expect(pp.startedAt).toBe('2026-04-01T00:00:00Z')
  })
})
