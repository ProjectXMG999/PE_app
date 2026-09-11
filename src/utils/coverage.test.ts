import { describe, it, expect } from 'vitest'
import { coverageFor, coveragePct, coverageGain, wordsForCoverage, COVERAGE_CURVE } from './coverage'
import { LEVEL_META } from '../data/levels'

describe('coverageFor', () => {
  it('is 0 at zero and never negative', () => {
    expect(coverageFor(0)).toBe(0)
    expect(coverageFor(-500)).toBe(0)
  })

  it('hits every anchor exactly — the number must never contradict the copy', () => {
    for (const a of COVERAGE_CURVE) {
      expect(coverageFor(a.words)).toBeCloseTo(a.pct, 6)
    }
  })

  it('agrees with the four station promises the product already shows', () => {
    // LEVEL_META thresholds must all be anchors, or the headline could disagree
    // with "Dogadasz się w podróży" et al.
    for (const level of LEVEL_META) {
      expect(COVERAGE_CURVE.some(a => a.words === level.threshold)).toBe(true)
    }
  })

  it('rises monotonically and never overshoots the final anchor', () => {
    let prev = -1
    for (let w = 0; w <= 12000; w += 37) {
      const c = coverageFor(w)
      expect(c).toBeGreaterThanOrEqual(prev)
      expect(c).toBeLessThanOrEqual(98)
      prev = c
    }
  })

  it('saturates past the end of the route', () => {
    expect(coverageFor(10000)).toBe(98)
    expect(coverageFor(50000)).toBe(98)
  })

  it('interpolates between anchors', () => {
    // Halfway from 1000 (80) to 2000 (89) → ~84.5
    expect(coverageFor(1500)).toBeCloseTo(84.5, 6)
  })
})

describe('coveragePct', () => {
  it('returns whole numbers only — no false precision', () => {
    for (const w of [0, 137, 1221, 4500, 9999]) {
      expect(Number.isInteger(coveragePct(w))).toBe(true)
    }
  })
})

describe('coverageGain', () => {
  it('makes the early route worth far more than the late route', () => {
    // The whole reason the order is the product.
    expect(coverageGain(0, 100)).toBeGreaterThan(coverageGain(5000, 100) * 5)
  })

  it('is never negative', () => {
    for (let w = 0; w < 11000; w += 250) {
      expect(coverageGain(w, 100)).toBeGreaterThanOrEqual(0)
    }
  })

  it('goes to zero past the end of the curve', () => {
    expect(coverageGain(10500, 100)).toBe(0)
  })
})

describe('wordsForCoverage', () => {
  it('round-trips the anchors', () => {
    for (const a of COVERAGE_CURVE) {
      if (a.pct === 0) continue
      expect(wordsForCoverage(a.pct)).toBe(a.words)
    }
  })

  it('returns null for a target the curve never reaches', () => {
    expect(wordsForCoverage(99.5)).toBeNull()
  })

  it('returns 0 for a non-positive target', () => {
    expect(wordsForCoverage(0)).toBe(0)
  })
})
