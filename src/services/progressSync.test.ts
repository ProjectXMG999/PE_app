import { describe, it, expect } from 'vitest'
import { betterPackageProgress, sessionKey } from './progressSync'
import { PackageProgress, Session } from '../types/progress'

function pkg(over: Partial<PackageProgress> = {}): PackageProgress {
  return {
    packageId: 'p1', startedAt: '2026-05-01T00:00:00Z',
    completedAt: null, masteredAt: null, listenedAt: null, currentIndex: 0,
    ...over,
  }
}

/* The merge runs on every sign-in and is the one place a cross-device
   reconciliation can quietly undo real progress. It used to return whichever
   whole row looked "more advanced", so the three axes could not disagree
   without one of them losing. */
describe('betterPackageProgress', () => {
  it('a mastered row from one device does not erase a listen position from the other', () => {
    const merged = betterPackageProgress(
      pkg({ masteredAt: '2026-06-01T00:00:00Z' }),
      pkg({ currentIndex: 7, listenedAt: '2026-05-20T00:00:00Z' }),
    )
    expect(merged.masteredAt).toBe('2026-06-01T00:00:00Z')
    expect(merged.currentIndex).toBe(7)
    expect(merged.listenedAt).toBe('2026-05-20T00:00:00Z')
  })

  it('keeps every milestone either side reached', () => {
    const merged = betterPackageProgress(
      pkg({ completedAt: '2026-06-01T00:00:00Z' }),
      pkg({ listenedAt: '2026-06-02T00:00:00Z' }),
    )
    expect(merged.completedAt).toBe('2026-06-01T00:00:00Z')
    expect(merged.listenedAt).toBe('2026-06-02T00:00:00Z')
  })

  it('dates each milestone to the first time it happened', () => {
    const merged = betterPackageProgress(
      pkg({ listenedAt: '2026-06-10T00:00:00Z', masteredAt: '2026-06-10T00:00:00Z' }),
      pkg({ listenedAt: '2026-03-02T00:00:00Z', masteredAt: '2026-04-02T00:00:00Z' }),
    )
    expect(merged.listenedAt).toBe('2026-03-02T00:00:00Z')
    expect(merged.masteredAt).toBe('2026-04-02T00:00:00Z')
  })

  it('takes the furthest playback position and the earliest start', () => {
    const merged = betterPackageProgress(
      pkg({ startedAt: '2026-05-01T00:00:00Z', currentIndex: 3 }),
      pkg({ startedAt: '2026-01-01T00:00:00Z', currentIndex: 9 }),
    )
    expect(merged.startedAt).toBe('2026-01-01T00:00:00Z')
    expect(merged.currentIndex).toBe(9)
  })

  it('is order-independent', () => {
    const a = pkg({ currentIndex: 4, completedAt: '2026-06-01T00:00:00Z' })
    const b = pkg({ currentIndex: 9, listenedAt: '2026-05-01T00:00:00Z' })
    expect(betterPackageProgress(a, b)).toEqual(betterPackageProgress(b, a))
  })
})

function sess(over: Partial<Session> = {}): Session {
  return { packageId: 'p1', date: '2026-05-01', wordsCompleted: 10, mode: 'fiszki', ...over }
}

/* The session log is unioned by this key on every sign-in. The two sides spell
   the same instant differently — the local clock writes `…Z`, PostgREST renders
   the timestamptz column as `…+00:00` — so comparing the raw strings made every
   session look local-only to the push AND remote-only to the pull. The log grew
   on every merge, taking study time, the streak and the readiness score with
   it. */
describe('sessionKey', () => {
  it('matches the same instant across the two timestamp spellings', () => {
    const local = sess({ startedAt: '2026-05-01T10:11:12.345Z' })
    const remote = sess({ startedAt: '2026-05-01T10:11:12.345+00:00' })
    expect(sessionKey(local)).toBe(sessionKey(remote))
  })

  it('matches across a non-UTC offset for the same instant', () => {
    expect(sessionKey(sess({ startedAt: '2026-05-01T12:11:12.345+02:00' })))
      .toBe(sessionKey(sess({ startedAt: '2026-05-01T10:11:12.345Z' })))
  })

  it('still separates two genuinely distinct sessions', () => {
    expect(sessionKey(sess({ startedAt: '2026-05-01T10:11:12.345Z' })))
      .not.toBe(sessionKey(sess({ startedAt: '2026-05-01T10:11:13.345Z' })))
  })

  it('keeps pre-timestamp sessions on the old loose key', () => {
    expect(sessionKey(sess())).toBe(sessionKey(sess({ startedAt: undefined })))
  })

  it('leaves an unparseable stamp alone rather than collapsing it to empty', () => {
    const odd = sessionKey(sess({ startedAt: 'not-a-date' }))
    expect(odd).not.toBe(sessionKey(sess({ startedAt: undefined })))
    expect(odd).toBe(sessionKey(sess({ startedAt: 'not-a-date' })))
  })
})
