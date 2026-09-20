import { describe, it, expect } from 'vitest'
import { computePoints, POINTS } from './points'
import { ProgressSnapshot } from '../hooks/useProgressData'
import { PackageProgress } from '../types/progress'

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    packageProgress: [],
    progressMap: new Map(),
    wordProgress: [],
    knownMap: new Map(),
    knownTotal: 0,
    declaredKnownTotal: 0,
    declaredKnownMap: new Map(),
    dueCount: 0,
    dueWords: [],
    servingLeft: 0,
    reviewBudget: 0,
    reviewSecPerCard: 10,
    served: 0,
    maintenanceLoad: { perDay: 0, minutesPerDay: 0, coveredPct: 0 },
    retiredCount: 0,
    declaredRetiredCount: 0,
    staleCount: 0,
    reviewUrgency: 'calm',
    reviewTotal: 0,
    reviewLedger: [],
    sessions: [],
    streak: 0,
    ...over,
  } as ProgressSnapshot
}

function pkg(id: string, over: Partial<PackageProgress> = {}): PackageProgress {
  return { packageId: id, startedAt: '2026-05-01', completedAt: null, masteredAt: null, currentIndex: 0, ...over }
}

describe('computePoints — declared-known exclusion', () => {
  it('a fully declared level earns zero known/retired/pack points despite knownTotal > 0', () => {
    const snap = snapshot({
      knownTotal: 1090,
      declaredKnownTotal: 1090,
      retiredCount: 1090,
      declaredRetiredCount: 1090,
      knownMap: new Map([['p1', 10]]),
      declaredKnownMap: new Map([['p1', 10]]),
      packageProgress: [pkg('p1', { masteredAt: '2026-06-01', completedAt: '2026-06-01' })],
    })
    const { breakdown } = computePoints(snap)
    expect(breakdown.known).toBe(0)
    expect(breakdown.retired).toBe(0)
    expect(breakdown.packs).toBe(0)
  })

  it('a mix of real and declared words only pays out for the real ones', () => {
    const snap = snapshot({ knownTotal: 100, declaredKnownTotal: 40 })
    const { breakdown } = computePoints(snap)
    expect(breakdown.known).toBe((100 - 40) * POINTS.perKnownWord)
  })

  it('retirement bonus nets out declared retirements the same way', () => {
    const snap = snapshot({ retiredCount: 20, declaredRetiredCount: 5 })
    const { breakdown } = computePoints(snap)
    expect(breakdown.retired).toBe((20 - 5) * POINTS.perRetiredWord)
  })

  it('a pack mastered with a MIX of real and declared words still earns the pack bonus', () => {
    const snap = snapshot({
      knownMap: new Map([['p1', 10]]),
      declaredKnownMap: new Map([['p1', 4]]), // 4 of 10 declared, 6 real
      packageProgress: [pkg('p1', { masteredAt: '2026-06-01' })],
    })
    const { breakdown } = computePoints(snap)
    expect(breakdown.packs).toBe(POINTS.perMasteredPack)
  })

  it('an untouched, fully organic snapshot behaves exactly as before (no declared fields set)', () => {
    const snap = snapshot({
      knownTotal: 50, reviewTotal: 10, retiredCount: 2,
      packageProgress: [pkg('p1', { masteredAt: '2026-06-01' }), pkg('p2', { completedAt: '2026-06-01' })],
    })
    const { breakdown } = computePoints(snap)
    expect(breakdown.known).toBe(50 * POINTS.perKnownWord)
    expect(breakdown.retired).toBe(2 * POINTS.perRetiredWord)
    expect(breakdown.packs).toBe(POINTS.perMasteredPack + POINTS.perCompletedPack)
  })
})
