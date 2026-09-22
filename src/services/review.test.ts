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

  it('an answered first "Znam" outranks a bulk declaration of the same word', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const { BULK_KNOWN_STABILITY, FIRST_KNOWN_STABILITY } = await import('./reviewConfig')
    const answered = applyKnown(undefined, 'w1', 'p1', today)
    const bulk = applyKnown(undefined, 'w2', 'p1', today, { bulk: true })

    expect(bulk.stability).toBe(BULK_KNOWN_STABILITY)
    expect(answered.stability).toBe(FIRST_KNOWN_STABILITY)
    // The ordering IS the fix. Both gestures claim prior knowledge, but one was
    // said after a real attempt at recall on that specific word and the other
    // was a tap on a pack the learner never opened. It used to run the other
    // way: 15 days for the declaration, 3 for the answer.
    expect(answered.stability!).toBeGreaterThan(bulk.stability!)
    expect(daysBetween('2026-06-01', answered.nextReviewAt!)).toBeGreaterThan(
      daysBetween('2026-06-01', bulk.nextReviewAt!)
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

  it('a first-ever "Znam" is a claim about prior knowledge, not a recall measurement', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const { FIRST_KNOWN_STABILITY, FIRST_KNOWN_DIFFICULTY } = await import('./reviewConfig')
    const wp = applyKnown(undefined, 'w1', 'p1', today)

    expect(wp.status).toBe('known')
    expect(wp.stability).toBe(FIRST_KNOWN_STABILITY)
    expect(wp.difficulty).toBe(FIRST_KNOWN_DIFFICULTY)
    // ±8% fuzz around 100.
    expect(daysBetween('2026-06-01', wp.nextReviewAt!)).toBeGreaterThanOrEqual(92)
    expect(daysBetween('2026-06-01', wp.nextReviewAt!)).toBeLessThanOrEqual(108)
    // The claim is flagged as unverified, but NOT as a declaration: the learner
    // faced the word, so it still counts toward points.
    expect(wp.assertedKnownAt).toBeTruthy()
    expect(wp.declaredKnownAt).toBeUndefined()
  })

  it('only the FIRST verdict gets the claim seed — a word already answered takes the normal path', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown, applyUnknown } = await import('./review')
    const { FIRST_KNOWN_STABILITY } = await import('./reviewConfig')

    // "Nie znam" first: the word now carries measured FSRS state.
    const missed = applyUnknown(undefined, 'w1', 'p1', today)
    const later = applyKnown(missed, 'w1', 'p1', new Date('2026-06-05T12:00:00Z'))
    expect(later.stability).not.toBe(FIRST_KNOWN_STABILITY)
    expect(later.stability!).toBeLessThan(FIRST_KNOWN_STABILITY)
    expect(later.assertedKnownAt).toBeUndefined()

    // A pre-FSRS "Nie znam" left NEITHER stability nor reviewCount — only
    // `status: 'learning'` tells it apart from a word nobody has ever seen.
    const legacyLearning = {
      wordId: 'w2', packageId: 'p1', seenCount: 1,
      lastSeen: '2026-05-01T12:00:00Z', status: 'learning',
    } as WordProgress
    const graduated = applyKnown(legacyLearning, 'w2', 'p1', today)
    expect(graduated.stability).not.toBe(FIRST_KNOWN_STABILITY)
    expect(graduated.assertedKnownAt).toBeUndefined()
  })

  it('surviving the first interval turns the claim into a measurement', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown, applyUnknown } = await import('./review')
    const claimed = applyKnown(undefined, 'w1', 'p1', today)
    expect(claimed.assertedKnownAt).toBeTruthy()

    const confirmed = applyKnown(claimed, 'w1', 'p1', new Date('2026-09-09T12:00:00Z'))
    expect(confirmed.assertedKnownAt).toBeUndefined()
    expect(confirmed.stability!).toBeGreaterThan(claimed.stability!)

    // Being wrong is evidence too — the claim ends either way.
    const refuted = applyUnknown(claimed, 'w1', 'p1', new Date('2026-09-09T12:00:00Z'))
    expect(refuted.assertedKnownAt).toBeUndefined()
    expect(refuted.stability!).toBeLessThan(claimed.stability!)
  })

  it('a same-day repeat does not settle the claim — surviving the interval does', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const claimed = applyKnown(undefined, 'w1', 'p1', today)

    // Answering again an hour later proves nothing: the word has not been away
    // from the learner for a single night. Caught on a real account, where
    // Trenuj re-serves a fully-known pack and the second "Znam" promoted the
    // word into "Dobrze znane" while its schedule sat frozen.
    const again = applyKnown(claimed, 'w1', 'p1', new Date('2026-06-01T18:00:00Z'))
    expect(again.assertedKnownAt).toBe(claimed.assertedKnownAt)
    expect(again.nextReviewAt).toBe(claimed.nextReviewAt)
    expect(again.seenCount).toBe(2)
  })

  it('within one day an answer may shorten the schedule but never lengthen it', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown, applyUnknown } = await import('./review')

    // Morning: a first "Znam" buys a hundred days. No clamp — nothing to clamp
    // against, this is the word's first verdict.
    const morning = applyKnown(undefined, 'w1', 'p1', today)
    expect(daysBetween('2026-06-01', morning.nextReviewAt!)).toBeGreaterThan(90)

    // Afternoon, same day: "Znam" again (a "Powtórz" run, or handleMastered
    // sweeping the pack). FSRS would score this as a full night's gap and grow
    // stability off a recall a minute old.
    const afternoon = applyKnown(morning, 'w1', 'p1', new Date('2026-06-01T18:00:00Z'))
    expect(afternoon.nextReviewAt).toBe(morning.nextReviewAt)
    expect(afternoon.stability).toBe(morning.stability)
    expect(afternoon.seenCount).toBe(2) // the interaction is still recorded

    // Evening: "actually, no". A correction downward still lands.
    const evening = applyUnknown(morning, 'w1', 'p1', new Date('2026-06-01T21:00:00Z'))
    expect(evening.nextReviewAt! < morning.nextReviewAt!).toBe(true)
    expect(evening.stability!).toBeLessThan(morning.stability!)
  })

  it('a level-mastery declaration outranks the scheduler on "Znam", and a real miss ends it', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown, applyUnknown, isDeclaredRetiredWord } = await import('./review')
    const declaredRetired = {
      wordId: 'w1', packageId: 'p1', seenCount: 2, lastSeen: '2026-01-01T12:00:00Z',
      status: 'known', retiredAt: '2026-01-02T00:00:00Z',
      declaredRetiredAt: '2026-01-02T00:00:00Z', declaredKnownAt: '2026-01-02T00:00:00Z',
    } as WordProgress

    // "Znam": the declaration stands. It used to lose retiredAt while keeping
    // declaredRetiredAt, which strands isDeclaredRetiredWord on false.
    const kept = applyKnown(declaredRetired, 'w1', 'p1', today)
    expect(kept.retiredAt).toBe('2026-01-02T00:00:00Z')
    expect(kept.nextReviewAt).toBeUndefined()
    expect(isDeclaredRetiredWord(kept)).toBe(true)

    // "Nie znam": a demonstrated miss beats a declaration. Both flags go, so
    // nothing is left stranded.
    const refuted = applyUnknown(declaredRetired, 'w1', 'p1', today)
    expect(refuted.retiredAt).toBeUndefined()
    expect(refuted.declaredRetiredAt).toBeUndefined()
    expect(refuted.nextReviewAt).toBeTruthy()
    expect(isDeclaredRetiredWord(refuted)).toBe(false)
  })

  it('"Znam wszystko" (bulk) stamps declaredKnownAt; a normal first "Znam" does not', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const bulk = applyKnown(undefined, 'w1', 'p1', today, { bulk: true })
    const normal = applyKnown(undefined, 'w2', 'p1', today)
    expect(bulk.declaredKnownAt).toBeTruthy()
    expect(normal.declaredKnownAt).toBeUndefined()
  })

  it('a real "Znam" on a previously bulk-declared word clears declaredKnownAt', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown } = await import('./review')
    const declared = applyKnown(undefined, 'w1', 'p1', today, { bulk: true })
    expect(declared.declaredKnownAt).toBeTruthy()
    const reviewed = applyKnown(declared, 'w1', 'p1', new Date('2026-06-15T12:00:00Z'))
    expect(reviewed.declaredKnownAt).toBeUndefined()
  })

  it('a real "Nie znam" on a previously bulk-declared word clears declaredKnownAt too', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', mockFsrs)
    const { applyKnown, applyUnknown } = await import('./review')
    const declared = applyKnown(undefined, 'w1', 'p1', today, { bulk: true })
    const lapsed = applyUnknown(declared, 'w1', 'p1', new Date('2026-06-15T12:00:00Z'))
    expect(lapsed.status).toBe('known') // permanent, per the module doc comment
    expect(lapsed.declaredKnownAt).toBeUndefined()
  })
})

describe('isDeclaredKnownWord / isDeclaredRetiredWord', () => {
  it('is false for anything not status:known', async () => {
    vi.resetModules()
    const { isDeclaredKnownWord } = await import('./review')
    expect(isDeclaredKnownWord(undefined)).toBe(false)
    expect(isDeclaredKnownWord({ status: 'learning' } as WordProgress)).toBe(false)
  })

  it('trusts an explicit declaredKnownAt', async () => {
    vi.resetModules()
    const { isDeclaredKnownWord } = await import('./review')
    expect(isDeclaredKnownWord({ status: 'known', declaredKnownAt: today.toISOString() } as WordProgress)).toBe(true)
  })

  it('falls back to the numeric fingerprint for pre-migration rows, without misclassifying a real first "Znam"', async () => {
    vi.resetModules()
    vi.doMock('./reviewConfig', async orig => ({ ...(await orig<object>()), FSRS_ENABLED: true, GRADUATION_ENABLED: true }))
    const { applyKnown, isDeclaredKnownWord } = await import('./review')
    const { BULK_KNOWN_STABILITY, BULK_KNOWN_DIFFICULTY } = await import('./reviewConfig')

    const legacyBulk = {
      status: 'known', reviewCount: 0, stability: BULK_KNOWN_STABILITY, difficulty: BULK_KNOWN_DIFFICULTY,
    } as WordProgress
    expect(isDeclaredKnownWord(legacyBulk)).toBe(true)

    // Seeds (FIRST_KNOWN_STABILITY, FIRST_KNOWN_DIFFICULTY) = (100, 4.5). The
    // two DIFFICULTIES are equal on purpose; the fingerprint matches on the
    // pair, so it is the stabilities that must never converge — 100 ≠ 15.
    const organicFirstKnown = applyKnown(undefined, 'w1', 'p1', today)
    expect(organicFirstKnown.difficulty).toBe(BULK_KNOWN_DIFFICULTY)
    expect(isDeclaredKnownWord(organicFirstKnown)).toBe(false)
  })

  it('isDeclaredRetiredWord requires both retiredAt and declaredRetiredAt', async () => {
    vi.resetModules()
    const { isDeclaredRetiredWord } = await import('./review')
    expect(isDeclaredRetiredWord({ retiredAt: today.toISOString() } as WordProgress)).toBe(false)
    expect(isDeclaredRetiredWord({
      retiredAt: today.toISOString(), declaredRetiredAt: today.toISOString(),
    } as WordProgress)).toBe(true)
  })
})
