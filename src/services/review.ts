import { WordProgress } from '../types/progress'
import { dayKey, shiftDay } from '../utils/day'

/**
 * Review scheduling.
 *
 * The rule that shapes everything here: **`status: 'known'` is permanent.** Once
 * a word has been mastered it never drops back to 'learning', because the number
 * on the route must never go backwards — watching a hard-won count shrink is
 * demoralising and makes the map feel untrustworthy.
 *
 * Forgetting is tracked separately instead. A missed answer on a mastered word
 * bumps `lapseCount`, walks `reviewCount` back one rung, and reschedules the
 * word for tomorrow. The route count is untouched; what changes is how *fresh*
 * the route is, which is surfaced as its own metric.
 */

/**
 * Days until the next review, indexed by how many times the word has already
 * been re-confirmed. A brand-new word comes back in 3 days; each successful
 * recall pushes it further out, up to roughly half a year.
 */
const REVIEW_LADDER = [3, 7, 21, 60, 180]

function intervalFor(reviewCount: number): number {
  return REVIEW_LADDER[Math.min(reviewCount, REVIEW_LADDER.length - 1)]
}

/** True when the word is scheduled and its date has arrived. */
export function isDue(wp: WordProgress, on: string = dayKey()): boolean {
  return wp.nextReviewAt != null && wp.nextReviewAt <= on
}

/**
 * The user recalled the word ("Znam").
 *
 * A word that was already mastered climbs one rung of the ladder; a word being
 * mastered for the first time starts at the bottom of it.
 */
export function applyKnown(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date()
): WordProgress {
  const wasKnown = existing?.status === 'known'
  const reviewCount = wasKnown ? (existing?.reviewCount ?? 0) + 1 : (existing?.reviewCount ?? 0)

  return {
    wordId,
    packageId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: now.toISOString(),
    status: 'known',
    reviewCount,
    lapseCount: existing?.lapseCount,
    lastLapseAt: existing?.lastLapseAt,
    nextReviewAt: shiftDay(intervalFor(reviewCount), dayKey(now)),
  }
}

/**
 * The user could not recall the word ("Nie znam").
 *
 * Note this writes at all — previously the button did nothing, which meant the
 * app had no idea which words were slipping away and `seenCount` only ever
 * counted successes (quietly inflating the retention score toward 100 %).
 */
export function applyUnknown(
  existing: WordProgress | undefined,
  wordId: string,
  packageId: string,
  now: Date = new Date()
): WordProgress {
  const wasKnown = existing?.status === 'known'
  const nowIso = now.toISOString()
  const tomorrow = shiftDay(1, dayKey(now))

  return {
    wordId,
    packageId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: nowIso,
    // Mastered stays mastered. Only a word that was never mastered can move,
    // and only up to 'learning'.
    status: wasKnown ? 'known' : 'learning',
    // Walk one rung back down the ladder so the word returns sooner next time.
    reviewCount: wasKnown ? Math.max(0, (existing?.reviewCount ?? 0) - 1) : existing?.reviewCount,
    lapseCount: wasKnown ? (existing?.lapseCount ?? 0) + 1 : existing?.lapseCount,
    lastLapseAt: wasKnown ? nowIso : existing?.lastLapseAt,
    nextReviewAt: tomorrow,
  }
}
