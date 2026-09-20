import { describe, it, expect } from 'vitest'
import { applyListenProgress } from './listenAxis'

const now = new Date('2026-06-01T12:00:00Z')
const stamp = now.toISOString()

/* The regression these guard: every "odsłuchane" figure in the app reads the
   listen axis, and it used to be written by the card-advance path of BOTH
   study modes, plus Trenuj, plus the declarations. */

describe('applyListenProgress — fiszki never moves the axis', () => {
  it('leaves an untouched pack untouched', () => {
    const axis = applyListenProgress(undefined, {
      mode: 'fiszki', index: 3, reachedEnd: false, wordCount: 10,
    }, now)
    expect(axis).toEqual({ currentIndex: 0, listenedAt: null })
  })

  it('finishing a fiszki run does NOT claim the pack was listened through', () => {
    const axis = applyListenProgress({ currentIndex: 0, listenedAt: null }, {
      mode: 'fiszki', index: 10, reachedEnd: true, wordCount: 10,
    }, now)
    expect(axis).toEqual({ currentIndex: 0, listenedAt: null })
  })

  it('preserves a real listen position rather than resetting it', () => {
    const axis = applyListenProgress({ currentIndex: 6, listenedAt: '2026-05-01T00:00:00Z' }, {
      mode: 'fiszki', index: 2, reachedEnd: true, wordCount: 10,
    }, now)
    expect(axis).toEqual({ currentIndex: 6, listenedAt: '2026-05-01T00:00:00Z' })
  })
})

describe('applyListenProgress — autoplay', () => {
  it('advances the pointer mid-pack without stamping a play-through', () => {
    const axis = applyListenProgress({ currentIndex: 2, listenedAt: null }, {
      mode: 'autoplay', index: 5, reachedEnd: false, wordCount: 10,
    }, now)
    expect(axis).toEqual({ currentIndex: 5, listenedAt: null })
  })

  it('stamps listenedAt on reaching the end, and fills the pointer', () => {
    const axis = applyListenProgress({ currentIndex: 9, listenedAt: null }, {
      mode: 'autoplay', index: 9, reachedEnd: true, wordCount: 10,
    }, now)
    expect(axis).toEqual({ currentIndex: 10, listenedAt: stamp })
  })

  it('never regresses the pointer when a re-listen stops early', () => {
    const axis = applyListenProgress({ currentIndex: 8, listenedAt: null }, {
      mode: 'autoplay', index: 1, reachedEnd: false, wordCount: 10,
    }, now)
    expect(axis.currentIndex).toBe(8)
  })

  it('dates the play-through to the FIRST one — re-listening does not restamp', () => {
    const axis = applyListenProgress({ currentIndex: 10, listenedAt: '2026-01-01T00:00:00Z' }, {
      mode: 'autoplay', index: 10, reachedEnd: true, wordCount: 10,
    }, now)
    expect(axis.listenedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('clamps a pointer that overshoots the pack', () => {
    const axis = applyListenProgress({ currentIndex: 0, listenedAt: null }, {
      mode: 'autoplay', index: 99, reachedEnd: false, wordCount: 10,
    }, now)
    expect(axis.currentIndex).toBe(10)
  })
})
