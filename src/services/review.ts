import { WordProgress } from '../types/progress'
import { dayKey, shiftDay, daysBetween } from '../utils/day'
import {
  REVIEW_LADDER,
  RETIRE_AT_REVIEW_COUNT,
  RETIRE_STABILITY_DAYS,
  BULK_KNOWN_STABILITY,
  BULK_KNOWN_DIFFICULTY,
  BULK_KNOWN_REVIEW_COUNT,
  GRADUATION_ENABLED,
  FSRS_ENABLED,
} from './reviewConfig'
import { AGAIN, GOOD, Grade, FsrsResult, initCard, review, seedFromLadder, applyFuzz, nextInterval } from './fsrs'

/**
 * Review scheduling.
 *
 * The rule that shapes everything here: **`status: 'known'` is permanent.** Once
 * a word has been mastered it never drops back to 'learning', because the number
 * on the route must never go backwards. Forgetting is tracked separately —
 * `lapseCount` / `retiredAt` / the schedule — never by demoting `status`.
 *
 * Two scheduler backends, chosen by `FSRS_ENABLED`:
 *  - legacy: a fixed interval ladder indexed by `reviewCount` (see REVIEW_LADDER);
 *  - FSRS (src/services/fsrs.ts): per-word `stability` / `difficulty`, seeded
 *    lazily from the ladder on the first answer after the flag flips.
 *
 * Retirement ("emerytura"): pre-FSRS clears `nextReviewAt` at rung
 * RETIRE_AT_REVIEW_COUNT; FSRS keeps a real (long) `nextReviewAt` once
 * `stability` crosses RETIRE_STABILITY_DAYS — deep maintenance, ~yearly, so a
 * forgotten "retired" word is still eventually caught. Any lapse un-retires.
 */

/** Legacy: days until the next review, indexed by re-confirmation count. */
function intervalFor(reviewCount: number): number {
  return REVIEW_LADDER[Math.min(reviewCount, REVIEW_LADDER.length - 1)]
}

/** True when the word is scheduled and its date has arrived. */
export function isDue(wp: WordProgress, on: string = dayKey()): boolean {
  return wp.nextReviewAt != null && wp.nextReviewAt <= on
}

/** Runs the FSRS model for one answer, seeding state if the word has none yet. */
function fsrsApply(existing: WordProgress | undefined, grade: Grade, now: Date): FsrsResult {
  if (existing?.stability != null && existing?.difficulty != null) {
    const elapsed = existing.lastSeen
      ? daysBetween(dayKey(new Date(existing.lastSeen)), dayKey(now))
      : 1
    return review({ stability: existing.stability, difficulty: existing.difficulty }, grade, elapsed)
  }
  if (existing?.reviewCount != null || existing?.status === 'known') {
    // Existing user, ladder history only — seed from the rung, then apply.
    const seeded = seedFromLadder(REVIEW_LADDER, existing?.reviewCount, existing?.lapseCount)
    const elapsed = existing?.lastSeen
      ? daysBetween(dayKey(new Date(existing.lastSeen)), dayKey(now))
      : 1
    return review(seeded, grade, elapsed)
  }
  return initCard(grade) // brand-new word, first answer
}

/**
 * The user recalled the word ("Znam").
 *
 * `opts.bulk` — this is "Znam wszystko" from the pack preview: the user is
 * asserting prior knowledge, not learning the word now, so a word with no real
 * history is seeded a couple of levels in (BULK_KNOWN_*) instead of at the
 * 3-day first rung. Words that already have history take the normal path.
 */
export function applyKnown(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date(),
  opts: { bulk?: boolean } = {}
): WordProgress {
  const wasKnown = existing?.status === 'known'
  // Only seed for a word with no meaningful review history.
  const bulkSeed =
    !!opts.bulk && !wasKnown && (existing?.reviewCount ?? 0) === 0 && existing?.stability == null

  const reviewCount = bulkSeed
    ? BULK_KNOWN_REVIEW_COUNT // legacy ladder needs this to skip ahead; FSRS ignores it for the schedule
    : wasKnown
      ? (existing?.reviewCount ?? 0) + 1
      : (existing?.reviewCount ?? 0)

  const base = {
    wordId,
    packageId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: now.toISOString(),
    status: 'known' as const,
    reviewCount,
    lapseCount: existing?.lapseCount,
    lastLapseAt: existing?.lastLapseAt,
  }

  if (!FSRS_ENABLED) {
    const graduating = GRADUATION_ENABLED && wasKnown && reviewCount >= RETIRE_AT_REVIEW_COUNT
    return {
      ...base,
      retiredAt: graduating ? (existing?.retiredAt ?? now.toISOString()) : existing?.retiredAt,
      nextReviewAt: graduating ? undefined : shiftDay(intervalFor(reviewCount), dayKey(now)),
      stability: existing?.stability,
      difficulty: existing?.difficulty,
    }
  }

  if (bulkSeed) {
    // Assert a stability, don't run a review — the word is "already known well".
    return {
      ...base,
      reviewCount: existing?.reviewCount, // keep 0 on FSRS — no reviews were actually done
      retiredAt: undefined,
      nextReviewAt: shiftDay(applyFuzz(nextInterval(BULK_KNOWN_STABILITY)), dayKey(now)),
      stability: BULK_KNOWN_STABILITY,
      difficulty: BULK_KNOWN_DIFFICULTY,
    }
  }

  const res = fsrsApply(existing, GOOD, now)
  const durable = GRADUATION_ENABLED && res.stability >= RETIRE_STABILITY_DAYS
  return {
    ...base,
    // Deep maintenance: a durable word is tagged retired but STILL has a real date.
    retiredAt: durable ? (existing?.retiredAt ?? now.toISOString()) : undefined,
    nextReviewAt: shiftDay(applyFuzz(res.intervalDays), dayKey(now)),
    stability: res.stability,
    difficulty: res.difficulty,
  }
}

/**
 * The user could not recall the word ("Nie znam").
 *
 * Pre-FSRS the step-back is a single rung (or proportional behind
 * GRADUATION_ENABLED). Under FSRS the lapse formula produces the short interval
 * directly. Either way `reviewCount` is untouched and any lapse un-retires.
 */
export function applyUnknown(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date()
): WordProgress {
  const wasKnown = existing?.status === 'known'
  const nowIso = now.toISOString()

  const base = {
    wordId,
    packageId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: nowIso,
    status: (wasKnown ? 'known' : 'learning') as WordProgress['status'],
    lapseCount: wasKnown ? (existing?.lapseCount ?? 0) + 1 : existing?.lapseCount,
    lastLapseAt: wasKnown ? nowIso : existing?.lastLapseAt,
  }

  if (!FSRS_ENABLED) {
    const rc = existing?.reviewCount ?? 0
    const nextReviewCount = !wasKnown
      ? existing?.reviewCount
      : !GRADUATION_ENABLED
        ? Math.max(0, rc - 1)
        : rc <= 2
          ? 0
          : rc <= 4
            ? Math.max(0, rc - 2)
            : rc - 1
    return {
      ...base,
      reviewCount: nextReviewCount,
      retiredAt: wasKnown ? undefined : existing?.retiredAt,
      nextReviewAt: shiftDay(1, dayKey(now)),
      stability: existing?.stability,
      difficulty: existing?.difficulty,
    }
  }

  const res = fsrsApply(existing, AGAIN, now)
  return {
    ...base,
    reviewCount: existing?.reviewCount, // a lapse never increments
    retiredAt: wasKnown ? undefined : existing?.retiredAt,
    nextReviewAt: shiftDay(applyFuzz(res.intervalDays), dayKey(now)),
    stability: res.stability,
    difficulty: res.difficulty,
  }
}
