import { describe, it, expect, vi } from 'vitest'
import type { WordProgress } from '../types/progress'

// review.ts branches on FSRS_ENABLED / GRADUATION_ENABLED at module load, so each
// path is exercised in its own module registry with the flags mocked.

const today = new Date('2026-06-01T12:00:00Z')
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

describe('applyKnown / applyUnknown — legacy ladder path (FSRS_ENABLED = false)', () => {
  it('first "Znam" schedules 3 days out and does not touch stability', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', async orig => ({ ...(await orig<object>()), FSRS_ENABLED: false, GRADUATION_ENABLED: false }))
    const { applyKnown } = await import('./review')
    const wp = applyKnown(undefined, 'w1', 'p1', today)
    expect(wp.status).toBe('known')
    expect(wp.stability).toBeUndefined()
    expect(daysBetween('2026-06-01', wp.nextReviewAt!)).toBe(3)
  })

  it('"Nie znam" on a known word steps the rung back and reschedules for tomorrow', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', async orig => ({ ...(await orig<object>()), FSRS_ENABLED: false, GRADUATION_ENABLED: false }))
    const { applyUnknown } = await import('./review')
    const existing = { wordId: 'w1', packageId: 'p1', seenCount: 5, lastSeen: '2026-05-01T12:00:00Z', status: 'known', reviewCount: 3 } as WordProgress
    const wp = applyUnknown(existing, 'w1', 'p1', today)
    expect(wp.status).toBe('known')
    expect(wp.reviewCount).toBe(2)
    expect((wp.lapseCount ?? 0)).toBe(1)
    expect(daysBetween('2026-06-01', wp.nextReviewAt!)).toBe(1)
  })
})

describe('applyKnown / applyUnknown — FSRS path (FSRS_ENABLED = true, GRADUATION_ENABLED = true)', () => {
  const mockFsrs = async (orig: () => Promise<object>) => ({
    ...(await orig()),
    FSRS_ENABLED: true,
    GRADUATION_ENABLED: true,
  })

  it('a new word gets FSRS state and a real nextReviewAt', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const wp = applyKnown(undefined, 'w1', 'p1', today)
    expect(wp.stability).toBeGreaterThan(0)
    expect(wp.difficulty).toBeGreaterThanOrEqual(1)
    expect(wp.nextReviewAt).toBeTruthy()
  })

  it('"Znam" on an FSRS word grows stability and pushes the date further out', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const existing = {
      wordId: 'w1', packageId: 'p1', seenCount: 4, lastSeen: '2026-05-20T12:00:00Z',
      status: 'known', reviewCount: 2, stability: 12, difficulty: 5,
    } as WordProgress
    const wp = applyKnown(existing, 'w1', 'p1', today)
    expect(wp.stability!).toBeGreaterThan(12)
    expect(daysBetween('2026-06-01', wp.nextReviewAt!)).toBeGreaterThan(12)
    expect(wp.reviewCount).toBe(3)
  })

  it('"Nie znam" on an FSRS word shrinks stability, un-retires, keeps reviewCount', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyUnknown } = await import('./review')
    const existing = {
      wordId: 'w1', packageId: 'p1', seenCount: 30, lastSeen: '2026-01-01T12:00:00Z',
      status: 'known', reviewCount: 6, stability: 400, difficulty: 4,
      retiredAt: '2026-01-01T12:00:00Z', nextReviewAt: '2027-01-01',
    } as WordProgress
    const wp = applyUnknown(existing, 'w1', 'p1', today)
    expect(wp.stability!).toBeLessThan(400)
    expect(wp.retiredAt).toBeUndefined()
    expect(wp.reviewCount).toBe(6) // a lapse never increments
    expect(wp.nextReviewAt).toBeTruthy()
  })

  it('crossing RETIRE_STABILITY_DAYS stamps retiredAt but keeps a real date', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const { RETIRE_STABILITY_DAYS } = await import('./reviewConfig')
    const existing = {
      wordId: 'w1', packageId: 'p1', seenCount: 20, lastSeen: '2025-06-01T12:00:00Z',
      status: 'known', reviewCount: 6, stability: RETIRE_STABILITY_DAYS - 10, difficulty: 3,
    } as WordProgress
    const wp = applyKnown(existing, 'w1', 'p1', today)
    expect(wp.stability!).toBeGreaterThanOrEqual(RETIRE_STABILITY_DAYS)
    expect(wp.retiredAt).toBeTruthy()
    expect(wp.nextReviewAt).toBeTruthy() // NOT cleared — deep maintenance
  })

  it('seeds FSRS state from the ladder for an existing user with no stability', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const existing = {
      wordId: 'w1', packageId: 'p1', seenCount: 8, lastSeen: '2026-05-25T12:00:00Z',
      status: 'known', reviewCount: 3, lapseCount: 1,
    } as WordProgress
    const wp = applyKnown(existing, 'w1', 'p1', today)
    expect(wp.stability).toBeGreaterThan(0)
    expect(wp.difficulty).toBeGreaterThan(5) // raised by the past lapse
  })

  it('"Znam wszystko" (bulk) seeds a fresh word past the first level', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const { BULK_KNOWN_STABILITY } = await import('./reviewConfig')
    const normal = applyKnown(undefined, 'w1', 'p1', today)
    const bulk = applyKnown(undefined, 'w2', 'p1', today, { bulk: true })
    expect(bulk.stability).toBe(BULK_KNOWN_STABILITY)
    expect(bulk.stability!).toBeGreaterThan(normal.stability!)
    expect(daysBetween('2026-06-01', bulk.nextReviewAt!)).toBeGreaterThan(
      daysBetween('2026-06-01', normal.nextReviewAt!)
    )
    expect(bulk.reviewCount ?? 0).toBe(0) // no reviews actually done → points stay honest
  })

  it('bulk on a word that already has FSRS history takes the normal path', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const existing = {
      wordId: 'w1', packageId: 'p1', seenCount: 4, lastSeen: '2026-05-20T12:00:00Z',
      status: 'known', reviewCount: 2, stability: 40, difficulty: 5,
    } as WordProgress
    const wp = applyKnown(existing, 'w1', 'p1', today, { bulk: true })
    expect(wp.stability!).toBeGreaterThan(40) // grew via a real review, not reseeded down
    expect(wp.reviewCount).toBe(3)
  })
})
