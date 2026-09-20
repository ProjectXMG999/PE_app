import { describe, it, expect } from 'vitest'
import { packageIdsForLevel, applyLevelMasteryToWord } from './levelMastery'
import type { WordProgress } from '../types/progress'

const today = new Date('2026-06-01T12:00:00Z')

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
