import { WordProgress } from '../types/progress'
import { dayKey, shiftDay, daysBetween } from '../utils/day'
import {
  REVIEW_LADDER,
  RETIRE_AT_REVIEW_COUNT,
  RETIRE_STABILITY_DAYS,
  BULK_KNOWN_STABILITY,
  BULK_KNOWN_DIFFICULTY,
  BULK_KNOWN_REVIEW_COUNT,
  FIRST_KNOWN_STABILITY,
  FIRST_KNOWN_DIFFICULTY,
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
 *
 * Two rules sit on top of the model, both about what an answer actually means:
 *  - the FIRST verdict a word ever gets is a statement about knowledge from
 *    before the app, not a recall measurement — see `firstExposure` below;
 *  - within one day an answer may shorten the schedule but never lengthen it,
 *    because FSRS scores a same-day repeat as a full night — `clampSameDay`.
 */

/** Legacy: days until the next review, indexed by re-confirmation count. */
function intervalFor(reviewCount: number): number {
  return REVIEW_LADDER[Math.min(reviewCount, REVIEW_LADDER.length - 1)]
}

/** True when the word is scheduled and its date has arrived. */
export function isDue(wp: WordProgress, on: string = dayKey()): boolean {
  return wp.nextReviewAt != null && wp.nextReviewAt <= on
}

/**
 * Within one day an answer may SHORTEN the schedule, never lengthen it.
 *
 * FSRS-4.5 has no short-term term, so `review()` clamps the gap to one day
 * (fsrs.ts). A second answer on the same day is therefore scored as if a night
 * had passed: retrievability comes out lower than it really is, `(1 − r)` is
 * bigger, and stability grows more than the evidence warrants. Three taps of
 * "Powtórz" used to push a word months out on the strength of three recalls a
 * minute apart.
 *
 * Only the schedule is frozen. seenCount, status, lapseCount and the declared
 * flags all still update — a second answer is a real interaction, it just isn't
 * a second night's worth of memory. And because the guard is one-directional, a
 * correction downward still lands: "Znam" in the morning and "Nie znam" in the
 * evening pulls the word back to tomorrow, which is exactly right.
 */
function clampSameDay(
  next: WordProgress,
  existing: WordProgress | undefined,
  now: Date
): WordProgress {
  if (existing?.lastSeen == null || existing.nextReviewAt == null) return next
  if (dayKey(new Date(existing.lastSeen)) !== dayKey(now)) return next
  // Compared on STABILITY, not on the dates: `nextReviewAt` carries ±8% fuzz,
  // so re-answering identically lands on a different day about as often as
  // not, and half of those would slip through a date comparison as a phantom
  // "correction". Stability is the quantity the answer actually moves — it
  // only falls on a lapse, which is exactly the case worth honouring.
  const a = next.stability
  const b = existing.stability
  const shortens = a != null && b != null
    ? a < b
    : next.nextReviewAt != null && next.nextReviewAt < existing.nextReviewAt
  if (shortens) return next
  return {
    ...next,
    nextReviewAt: existing.nextReviewAt,
    stability: existing.stability,
    difficulty: existing.difficulty,
    retiredAt: existing.retiredAt,
    // Held for the same reason the schedule is. An unverified first-exposure
    // claim is settled by SURVIVING its interval, and a second answer on the
    // day the claim was made has survived nothing — clearing the flag there
    // would promote the word into the retention tiers on the strength of two
    // taps a minute apart, which is the exact fiction the flag exists to stop.
    assertedKnownAt: existing.assertedKnownAt,
  }
}

/**
 * True when a word's `known` status was asserted by a bulk declaration rather
 * than earned by actually answering it — per-pack "Znam wszystko" or a
 * level-mastery mark (services/levelMastery.ts). Falls back to the
 * pre-migration numeric fingerprint (reviewCount 0 + the exact bulk FSRS
 * seed) for rows written before `declaredKnownAt` existed — a deliberate,
 * accepted retroactive correction: an organically answered first "Znam" seeds
 * (FIRST_KNOWN_STABILITY, FIRST_KNOWN_DIFFICULTY) and every later answer a
 * computed stability, so it never lands on the bulk PAIR and cannot be
 * misclassified. The two difficulties are equal on purpose; it is the
 * stabilities (100 vs 15) that must never converge — see reviewConfig.ts.
 */
export function isDeclaredKnownWord(wp: WordProgress | undefined): boolean {
  if (!wp || wp.status !== 'known') return false
  if (wp.declaredKnownAt != null) return true
  return (
    (wp.reviewCount ?? 0) === 0 &&
    wp.stability === BULK_KNOWN_STABILITY &&
    wp.difficulty === BULK_KNOWN_DIFFICULTY
  )
}

/** True when `retiredAt` was forced by a level-mastery declaration rather
 *  than earned via durable FSRS stability. No legacy fallback needed — this
 *  concept didn't exist before level mastery, so nothing predates the flag. */
export function isDeclaredRetiredWord(wp: WordProgress): boolean {
  return wp.retiredAt != null && wp.declaredRetiredAt != null
}

/** Runs the FSRS model for one answer, seeding state if the word has none yet. */
function fsrsApply(
  existing: WordProgress | undefined,
  grade: Grade,
  now: Date,
  rr?: number
): FsrsResult {
  if (existing?.stability != null && existing?.difficulty != null) {
    const elapsed = existing.lastSeen
      ? daysBetween(dayKey(new Date(existing.lastSeen)), dayKey(now))
      : 1
    return review({ stability: existing.stability, difficulty: existing.difficulty }, grade, elapsed, rr)
  }
  if (existing?.reviewCount != null || existing?.status === 'known') {
    // Existing user, ladder history only — seed from the rung, then apply.
    const seeded = seedFromLadder(REVIEW_LADDER, existing?.reviewCount, existing?.lapseCount)
    const elapsed = existing?.lastSeen
      ? daysBetween(dayKey(new Date(existing.lastSeen)), dayKey(now))
      : 1
    return review(seeded, grade, elapsed, rr)
  }
  return initCard(grade, rr) // brand-new word, first answer
}

/**
 * The user recalled the word ("Znam").
 *
 * `opts.bulk` — this is "Znam wszystko" from the pack preview: the user is
 * asserting prior knowledge, not learning the word now, so a word with no real
 * history is seeded a couple of levels in (BULK_KNOWN_*) instead of at the
 * 3-day first rung. Words that already have history take the normal path.
 *
 * `opts.requestRetention` — the learner's desired retention, from the
 * review-health loop (services/reviewHealth.ts, via `currentRequestRetention`).
 * Omitted anywhere, the population REQUEST_RETENTION applies and this behaves
 * exactly as it did before the loop existed.
 */
export function applyKnown(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date(),
  opts: { bulk?: boolean; requestRetention?: number } = {}
): WordProgress {
  const wasKnown = existing?.status === 'known'
  // Only seed for a word with no meaningful review history.
  const bulkSeed =
    !!opts.bulk && !wasKnown && (existing?.reviewCount ?? 0) === 0 && existing?.stability == null

  // The first verdict this word has ever received. Each clause rules out a
  // different kind of history, and all three are load-bearing:
  //   stability == null    — one "Nie znam" already wrote FSRS state;
  //   reviewCount == null  — a pre-FSRS user carries ladder history instead;
  //   status !== 'learning' — a "Nie znam" answered before FSRS_ENABLED left
  //     NEITHER of the above, so without this it would read as a fresh word.
  const firstExposure =
    !opts.bulk &&
    !wasKnown &&
    existing?.stability == null &&
    existing?.reviewCount == null &&
    existing?.status !== 'learning'

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
    // A bulk seed asserts the flag; a real "Znam" on an already-known word is
    // a genuine review, graduating it out of "declared" (a first-time known
    // that isn't a bulk seed never had the flag to begin with).
    declaredKnownAt: bulkSeed
      ? (existing?.declaredKnownAt ?? now.toISOString())
      : wasKnown
        ? undefined
        : existing?.declaredKnownAt,
    // A claim stops being a claim the moment the word survives a real interval.
    // Same lifecycle as declaredKnownAt above; the seed branch below sets it.
    assertedKnownAt: wasKnown ? undefined : existing?.assertedKnownAt,
    // Carried, not dropped. This object never listed the field, so every "Znam"
    // silently erased a level-mastery declaration — the other half of the bug
    // where `retiredAt` was cleared without checking it. Only "Cofnij" and a
    // real miss (applyUnknown) end the declaration.
    declaredRetiredAt: existing?.declaredRetiredAt,
  }

  if (!FSRS_ENABLED) {
    const graduating = GRADUATION_ENABLED && wasKnown && reviewCount >= RETIRE_AT_REVIEW_COUNT
    return clampSameDay({
      ...base,
      retiredAt: graduating ? (existing?.retiredAt ?? now.toISOString()) : existing?.retiredAt,
      nextReviewAt: graduating ? undefined : shiftDay(intervalFor(reviewCount), dayKey(now)),
      stability: existing?.stability,
      difficulty: existing?.difficulty,
    }, existing, now)
  }

  // A level-mastery declaration outranks anything the scheduler would say: the
  // learner took the word out of rotation for good, and only "Cofnij" puts it
  // back. Without this the word kept `declaredRetiredAt` while losing
  // `retiredAt`, which makes `isDeclaredRetiredWord` false and strands the
  // flag — the same invariant progressSync.ts guards explicitly on merge.
  // Defence in depth: today's Trenuj filters make this hard to reach.
  if (existing != null && isDeclaredRetiredWord(existing)) {
    return { ...base, retiredAt: existing.retiredAt, nextReviewAt: undefined }
  }

  if (bulkSeed) {
    // Assert a stability, don't run a review — the word is "already known well".
    return {
      ...base,
      reviewCount: existing?.reviewCount, // keep 0 on FSRS — no reviews were actually done
      retiredAt: undefined,
      nextReviewAt: shiftDay(
        applyFuzz(nextInterval(BULK_KNOWN_STABILITY, opts.requestRetention)),
        dayKey(now)
      ),
      stability: BULK_KNOWN_STABILITY,
      difficulty: BULK_KNOWN_DIFFICULTY,
    }
  }

  if (firstExposure) {
    // Knowledge from before the app — stated, not measured. Assert a stability
    // rather than running a review: `initCard(GOOD)` would answer the question
    // "how well do you recall what you just studied?", which isn't the question
    // that was asked. `declaredKnownAt` is deliberately NOT stamped — the
    // learner did face the word, so it counts toward points, unlike "Znam
    // wszystko". `assertedKnownAt` records that the claim is still unverified.
    return {
      ...base,
      assertedKnownAt: now.toISOString(),
      retiredAt: undefined,
      nextReviewAt: shiftDay(
        applyFuzz(nextInterval(FIRST_KNOWN_STABILITY, opts.requestRetention)),
        dayKey(now)
      ),
      stability: FIRST_KNOWN_STABILITY,
      difficulty: FIRST_KNOWN_DIFFICULTY,
    }
  }

  const res = fsrsApply(existing, GOOD, now, opts.requestRetention)
  const durable = GRADUATION_ENABLED && res.stability >= RETIRE_STABILITY_DAYS
  return clampSameDay({
    ...base,
    // Deep maintenance: a durable word is tagged retired but STILL has a real date.
    retiredAt: durable ? (existing?.retiredAt ?? now.toISOString()) : undefined,
    nextReviewAt: shiftDay(applyFuzz(res.intervalDays), dayKey(now)),
    stability: res.stability,
    difficulty: res.difficulty,
  }, existing, now)
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
  now: Date = new Date(),
  opts: { requestRetention?: number } = {}
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
    // A lapse on a known word is a real interaction — it graduates the word
    // out of "declared" even though the answer was wrong (see WordProgress
    // .declaredKnownAt: cleared on any real review/lapse, not just a success).
    declaredKnownAt: wasKnown ? undefined : existing?.declaredKnownAt,
    // Same rule for an unverified first-exposure claim, and for the same
    // reason: being wrong is evidence too. The word now has a measured
    // stability, so it stops being a claim.
    assertedKnownAt: wasKnown ? undefined : existing?.assertedKnownAt,
    // A real miss outranks a level-mastery declaration — the learner
    // demonstrably does not know the word — so the lapse below un-retires it.
    // Clear the declaration with it, or `retiredAt` goes while
    // `declaredRetiredAt` stays and strands `isDeclaredRetiredWord`.
    declaredRetiredAt: wasKnown ? undefined : existing?.declaredRetiredAt,
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
    return clampSameDay({
      ...base,
      reviewCount: nextReviewCount,
      retiredAt: wasKnown ? undefined : existing?.retiredAt,
      nextReviewAt: shiftDay(1, dayKey(now)),
      stability: existing?.stability,
      difficulty: existing?.difficulty,
    }, existing, now)
  }

  const res = fsrsApply(existing, AGAIN, now, opts.requestRetention)
  return clampSameDay({
    ...base,
    reviewCount: existing?.reviewCount, // a lapse never increments
    retiredAt: wasKnown ? undefined : existing?.retiredAt,
    nextReviewAt: shiftDay(applyFuzz(res.intervalDays), dayKey(now)),
    stability: res.stability,
    difficulty: res.difficulty,
  }, existing, now)
}
