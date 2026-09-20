import { describe, it, expect } from 'vitest'
import { repairedListenAxis, listenProofByPack } from './listenRepair'
import { Session } from '../types/progress'

function session(over: Partial<Session> = {}): Session {
  return {
    packageId: 'p1', date: '2026-05-20', wordsCompleted: 10, mode: 'autoplay', ...over,
  }
}

describe('listenProofByPack', () => {
  it('ignores every mode but autoplay', () => {
    const proof = listenProofByPack([
      session({ packageId: 'p1', mode: 'fiszki', trainMode: 'word-flash' }),
      session({ packageId: 'p2', mode: 'autoplay', startedAt: '2026-05-20T10:00:00Z' }),
    ])
    expect(proof.has('p1')).toBe(false)
    expect(proof.get('p2')).toBe('2026-05-20T10:00:00Z')
  })

  it('keeps the newest session per pack', () => {
    const proof = listenProofByPack([
      session({ startedAt: '2026-05-20T10:00:00Z' }),
      session({ startedAt: '2026-06-02T08:00:00Z' }),
      session({ startedAt: '2026-05-30T08:00:00Z' }),
    ])
    expect(proof.get('p1')).toBe('2026-06-02T08:00:00Z')
  })

  it('falls back to the day key for sessions written before startedAt existed', () => {
    const proof = listenProofByPack([session({ startedAt: undefined, date: '2026-04-01' })])
    expect(proof.get('p1')).toBe('2026-04-01T12:00:00.000Z')
  })
})

describe('repairedListenAxis', () => {
  it('clears a full listen claim with no session behind it', () => {
    const fixed = repairedListenAxis({
      progress: { currentIndex: 20, listenedAt: null },
      listenProof: null,
    })
    expect(fixed).toEqual({ currentIndex: 0, listenedAt: null })
  })

  it('clears a PARTIAL position too — those came from fiszki taps over a subset', () => {
    const fixed = repairedListenAxis({
      progress: { currentIndex: 2, listenedAt: null },
      listenProof: null,
    })
    expect(fixed).toEqual({ currentIndex: 0, listenedAt: null })
  })

  it('clears a listenedAt that no session supports', () => {
    const fixed = repairedListenAxis({
      progress: { currentIndex: 20, listenedAt: '2026-06-01T00:00:00Z' },
      listenProof: null,
    })
    expect(fixed).toEqual({ currentIndex: 0, listenedAt: null })
  })

  it('backfills the date on a genuine listen from before the field existed', () => {
    const fixed = repairedListenAxis({
      progress: { currentIndex: 20, listenedAt: null },
      listenProof: '2026-05-20T10:00:00Z',
    })
    expect(fixed).toEqual({ currentIndex: 20, listenedAt: '2026-05-20T10:00:00Z' })
  })

  it('leaves an already-truthful row alone, so nothing is rewritten or re-synced', () => {
    expect(repairedListenAxis({
      progress: { currentIndex: 20, listenedAt: '2026-05-20T10:00:00Z' },
      listenProof: '2026-05-20T10:00:00Z',
    })).toBeNull()

    expect(repairedListenAxis({
      progress: { currentIndex: 0, listenedAt: null },
      listenProof: null,
    })).toBeNull()
  })

  it('is idempotent — a second pass over its own output finds nothing', () => {
    const first = repairedListenAxis({
      progress: { currentIndex: 20, listenedAt: null },
      listenProof: null,
    })!
    expect(repairedListenAxis({ progress: first, listenProof: null })).toBeNull()
  })
})
