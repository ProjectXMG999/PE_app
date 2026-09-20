import { describe, it, expect } from 'vitest'
import { getStatus, STATUS_META } from './packVisuals'
import { PackageProgress } from '../types/progress'

function pkg(over: Partial<PackageProgress> = {}): PackageProgress {
  return {
    packageId: 'p1', startedAt: '2026-05-01T00:00:00Z',
    completedAt: null, masteredAt: null, listenedAt: null, currentIndex: 0,
    ...over,
  }
}

/* One badge, three axes — so they rank. The case that made this necessary is
   the last one: "✓ Odsłuchana" used to hang on `completedAt`, which a Trenuj
   run stamps, so a pack drilled in training claimed to have been heard. */
describe('getStatus', () => {
  it('no row at all is a new pack', () => {
    expect(getStatus(undefined)).toBe('new')
  })

  it('a row with nothing finished is in progress', () => {
    expect(getStatus(pkg())).toBe('started')
  })

  it('worked through but never played is "przerobiona", not "odsłuchana"', () => {
    expect(getStatus(pkg({ completedAt: '2026-06-01T00:00:00Z' }))).toBe('worked')
    expect(STATUS_META.worked.label).toBe('✓ Przerobiona')
  })

  it('played through is "odsłuchana"', () => {
    expect(getStatus(pkg({ listenedAt: '2026-06-01T00:00:00Z' }))).toBe('listened')
    expect(STATUS_META.listened.label).toBe('✓ Odsłuchana')
  })

  it('mastery outranks both', () => {
    expect(getStatus(pkg({
      masteredAt: '2026-06-01T00:00:00Z',
      listenedAt: '2026-06-01T00:00:00Z',
      completedAt: '2026-06-01T00:00:00Z',
    }))).toBe('mastered')
  })

  it('a play-through outranks having merely worked through', () => {
    expect(getStatus(pkg({
      listenedAt: '2026-06-01T00:00:00Z',
      completedAt: '2026-06-01T00:00:00Z',
    }))).toBe('listened')
  })
})
