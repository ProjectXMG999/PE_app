import { describe, expect, it } from 'vitest'
import { RETIRE_STABILITY_DAYS } from '../../../services/reviewConfig'
import { WordProgress } from '../../../types/progress'
import { PackMeta } from '../../../types/vocabulary'
import {
  brightnessFor,
  buildStarfield,
  hitTest,
  parseWordId,
  STAGE_DUE,
  STAGE_DUST,
  STAGE_KNOWN,
  STAGE_LEARNING,
  STAGE_PERMANENT,
  stageFor,
  STATE_DUST,
  STATE_KNOWN,
  STATE_LEARNING,
  STATE_RETIRED,
  wordIdAt,
} from './starfield'

function pack(id: string, level: number, wordCount: number): PackMeta {
  return { id, name: id, volume: 'Tom I', level, category: 'Test', wordCount, chapter: 'R I' }
}

function wp(wordId: string, over: Partial<WordProgress> = {}): WordProgress {
  return {
    wordId,
    packageId: wordId.slice(0, wordId.lastIndexOf('-')),
    seenCount: 1,
    lastSeen: '2026-09-01T10:00:00.000Z',
    status: 'known',
    ...over,
  }
}

const PACKS = [pack('t1-p001', 1, 10), pack('t1-p002', 1, 10), pack('t2-p003', 3, 5)]

describe('parseWordId', () => {
  it('splits a word id into pack and ordinal', () => {
    expect(parseWordId('t1-p001-007')).toEqual({ packId: 't1-p001', ordinal: 7 })
  })

  it('rejects ids that would silently shift every later star', () => {
    expect(parseWordId('t1p001007')).toBeNull()
    expect(parseWordId('t1-p001-000')).toBeNull()
    expect(parseWordId('t1-p001-abc')).toBeNull()
  })
})

describe('buildStarfield', () => {
  it('makes one star per word in the catalogue', () => {
    const f = buildStarfield(PACKS, [])
    expect(f.count).toBe(25)
    expect(f.position).toHaveLength(50)
    expect(f.litCount).toBe(0)
    expect([...f.state].every(s => s === STATE_DUST)).toBe(true)
  })

  it('places every star inside the unit disc', () => {
    const f = buildStarfield(PACKS, [])
    for (let i = 0; i < f.count; i++) {
      const r = Math.hypot(f.position[i * 2], f.position[i * 2 + 1])
      expect(r).toBeLessThanOrEqual(1.01)
    }
  })

  it('is deterministic — same input, identical field', () => {
    const a = buildStarfield(PACKS, [wp('t1-p002-003')])
    const b = buildStarfield(PACKS, [wp('t1-p002-003')])
    expect([...a.position]).toEqual([...b.position])
    expect([...a.seed]).toEqual([...b.seed])
  })

  it('carries the pack level onto each star', () => {
    const f = buildStarfield(PACKS, [])
    expect(f.level[0]).toBe(1)
    expect(f.level[19]).toBe(1)
    expect(f.level[20]).toBe(3)
  })

  it('maps word progress onto the right star', () => {
    // t1-p002-003 is the 3rd word of the 2nd pack → global index 12.
    const f = buildStarfield(PACKS, [wp('t1-p002-003')])
    expect(f.state[12]).toBe(STATE_KNOWN)
    expect(f.litCount).toBe(1)
    expect(f.packOf[12]).toBe(1)
    expect(f.ordinalOf[12]).toBe(3)
    expect(wordIdAt(f, PACKS, 12)).toBe('t1-p002-003')
  })

  it('separates learning, known and retired', () => {
    const f = buildStarfield(PACKS, [
      wp('t1-p001-001', { status: 'learning' }),
      wp('t1-p001-002', { status: 'known' }),
      wp('t1-p001-003', { status: 'known', retiredAt: '2026-08-01T00:00:00.000Z' }),
    ])
    expect(f.state[0]).toBe(STATE_LEARNING)
    expect(f.state[1]).toBe(STATE_KNOWN)
    expect(f.state[2]).toBe(STATE_RETIRED)
    expect(f.litCount).toBe(3)
  })

  it('leaves a new word as dust rather than lighting it', () => {
    const f = buildStarfield(PACKS, [wp('t1-p001-001', { status: 'new' })])
    expect(f.state[0]).toBe(STATE_DUST)
    expect(f.litCount).toBe(0)
    expect(f.progressOf[0]).toBe(-1)
  })

  it('ignores progress rows that no longer match a word in the catalogue', () => {
    const f = buildStarfield(PACKS, [wp('t9-p999-001'), wp('t1-p001-999')])
    expect(f.litCount).toBe(0)
  })

  it('flickers only words that have lapsed', () => {
    const f = buildStarfield(PACKS, [
      wp('t1-p001-001', { lapseCount: 2 }),
      wp('t1-p001-002', { lapseCount: 0 }),
      wp('t1-p001-003'),
    ])
    expect(f.flicker[0]).toBe(1)
    expect(f.flicker[1]).toBe(0)
    expect(f.flicker[2]).toBe(0)
  })

  it('orders the ignition sweep by when each word was learned', () => {
    const f = buildStarfield(PACKS, [
      wp('t1-p001-001', { lastSeen: '2026-03-01T00:00:00.000Z' }),
      wp('t1-p001-002', { lastSeen: '2026-01-01T00:00:00.000Z' }),
      wp('t1-p001-003', { lastSeen: '2026-02-01T00:00:00.000Z' }),
    ])
    // Oldest lights first.
    expect(f.ignite[1]).toBe(0)
    expect(f.ignite[2]).toBeCloseTo(0.5)
    expect(f.ignite[0]).toBe(1)
    // Dust never animates in.
    expect(f.ignite[5]).toBe(-1)
  })

  it('survives a single lit word without dividing by zero', () => {
    const f = buildStarfield(PACKS, [wp('t1-p001-001')])
    expect(Number.isFinite(f.ignite[0])).toBe(true)
    expect(f.ignite[0]).toBe(0)
  })
})

describe('brightnessFor', () => {
  it('grows with FSRS stability', () => {
    const dim = brightnessFor(wp('a-b-001', { stability: 1 }))
    const mid = brightnessFor(wp('a-b-001', { stability: 30 }))
    const bright = brightnessFor(wp('a-b-001', { stability: RETIRE_STABILITY_DAYS }))
    expect(dim).toBeLessThan(mid)
    expect(mid).toBeLessThan(bright)
    expect(bright).toBeCloseTo(1, 2)
  })

  it('never exceeds 1, even past the retirement threshold', () => {
    expect(brightnessFor(wp('a-b-001', { stability: 5000 }))).toBeLessThanOrEqual(1)
  })

  it('gives pre-FSRS words the middle of the band, not darkness', () => {
    // stability === undefined is a migration artefact, not forgetting.
    const b = brightnessFor(wp('a-b-001', { stability: undefined }))
    expect(b).toBeGreaterThan(0.5)
    expect(b).toBeLessThan(0.75)
  })

  it('burns a retired word at full brightness', () => {
    expect(brightnessFor(wp('a-b-001', { retiredAt: '2026-08-01T00:00:00.000Z' }))).toBe(1)
  })
})

describe('stageFor', () => {
  const TODAY = '2026-09-21'

  it('leaves an untouched word without a stage', () => {
    expect(stageFor(wp('a-b-001', { status: 'new' }), TODAY)).toBe(STAGE_DUST)
  })

  it('keeps a word in nauce even once its date has come round', () => {
    const learning = wp('a-b-001', { status: 'learning', nextReviewAt: '2026-09-01' })
    expect(stageFor(learning, TODAY)).toBe(STAGE_LEARNING)
  })

  it('marks a known word due on and after its date, not before', () => {
    expect(stageFor(wp('a-b-001', { nextReviewAt: '2026-09-22' }), TODAY)).toBe(STAGE_KNOWN)
    expect(stageFor(wp('a-b-001', { nextReviewAt: TODAY }), TODAY)).toBe(STAGE_DUE)
    expect(stageFor(wp('a-b-001', { nextReviewAt: '2026-08-01' }), TODAY)).toBe(STAGE_DUE)
  })

  it('treats an unscheduled known word as settled rather than due', () => {
    expect(stageFor(wp('a-b-001', { nextReviewAt: undefined }), TODAY)).toBe(STAGE_KNOWN)
  })

  it('shows a retired word as permanent — until its deep maintenance falls due', () => {
    const retired = { retiredAt: '2026-01-01T00:00:00.000Z' }
    expect(stageFor(wp('a-b-001', { ...retired, nextReviewAt: '2027-01-01' }), TODAY))
      .toBe(STAGE_PERMANENT)
    expect(stageFor(wp('a-b-001', { ...retired, nextReviewAt: '2026-09-01' }), TODAY))
      .toBe(STAGE_DUE)
  })
})

describe('buildStarfield — stages', () => {
  it('stamps each star with its stage, and dust with none', () => {
    const f = buildStarfield(
      PACKS,
      [
        wp('t1-p001-001', { status: 'learning' }),
        wp('t1-p001-002', { nextReviewAt: '2026-01-01' }),
        wp('t1-p001-003', { nextReviewAt: '2027-01-01' }),
        wp('t1-p001-004', { retiredAt: '2026-01-01T00:00:00.000Z' }),
      ],
      '2026-09-21',
    )
    expect(f.stage[0]).toBe(STAGE_LEARNING)
    expect(f.stage[1]).toBe(STAGE_DUE)
    expect(f.stage[2]).toBe(STAGE_KNOWN)
    expect(f.stage[3]).toBe(STAGE_PERMANENT)
    expect(f.stage[4]).toBe(STAGE_DUST)
  })

  it('gives every lit star a stage — the key must count them all', () => {
    const f = buildStarfield(
      PACKS,
      [
        wp('t1-p001-001', { status: 'learning' }),
        wp('t1-p001-002'),
        wp('t2-p003-001', { retiredAt: '2026-01-01T00:00:00.000Z' }),
      ],
      '2026-09-21',
    )
    let staged = 0
    for (let i = 0; i < f.count; i++) if (f.stage[i] !== STAGE_DUST) staged++
    expect(staged).toBe(f.litCount)
  })
})

describe('hitTest', () => {
  it('finds the lit star nearest a point', () => {
    const f = buildStarfield(PACKS, [wp('t1-p002-003')])
    const x = f.position[12 * 2]
    const y = f.position[12 * 2 + 1]
    expect(hitTest(f, x + 0.01, y + 0.01, 0.1)).toBe(12)
  })

  it('never returns dust — an unseen word has nothing to say', () => {
    const f = buildStarfield(PACKS, [])
    expect(hitTest(f, 0, 0, 2)).toBe(-1)
  })

  it('returns -1 when nothing is within the radius', () => {
    const f = buildStarfield(PACKS, [wp('t1-p002-003')])
    const x = f.position[12 * 2]
    const y = f.position[12 * 2 + 1]
    expect(hitTest(f, x + 0.5, y + 0.5, 0.01)).toBe(-1)
  })
})
