import { plural } from './plural'

/**
 * The learning-rate model behind every "when will I get there" projection —
 * Postęp's pace simulator and the daily-goal picker on Dzisiaj. One definition,
 * so the two screens can never promise different dates for the same goal.
 */

/** A sustained rate no learner beats over a whole history. A clamp, not a
 *  target: it only matters when the data behind the rate is thin or skewed. */
export const MAX_WORDS_PER_MINUTE = 5

/**
 * Words learned per minute of study. Bulk-marked words ("oznacz wszystkie jako
 * znam") are left out — they add a pack's worth of words in seconds against
 * zero study minutes, and would promise a pace nobody has actually shown.
 */
export function studyWordsPerMinute(knownWords: number, bulkKnownWords: number, studyMinutes: number): number {
  if (studyMinutes <= 0) return 0
  const studied = Math.max(0, knownWords - bulkKnownWords)
  return Math.min(studied / studyMinutes, MAX_WORDS_PER_MINUTE)
}

/**
 * A span of days as a Polish time-to-arrival: "12 dni", "3 mies.", "3,1 roku".
 * Fractional years take the genitive singular ("3,1 roku", never "3,1 lat").
 */
export function formatEta(days: number): string {
  if (days <= 0) return 'osiągnięte'
  if (days < 60) return `${days} ${plural(days, 'dzień', 'dni', 'dni')}`
  const months = Math.round(days / 30)
  if (months < 24) return `${months} mies.`
  return `${(days / 365).toFixed(1).replace('.', ',')} roku`
}
