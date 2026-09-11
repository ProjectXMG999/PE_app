import { dayKey, daysBetween } from '../utils/day'
import {
  REQUEST_RETENTION,
  ADAPTIVE_MIX_ENABLED,
  ADAPTIVE_RETENTION_ENABLED,
} from './reviewConfig'

/**
 * Review health — "is memory holding?", as one number.
 *
 * The counterpart to comfort.ts. Where `comfortLevel` asks *is the new material
 * the right difficulty* (and so reads only learn/stretch cards), this asks *is
 * what was already learned still sticking* — and so reads ONLY scheduled
 * reviews: the `review` segment of an Inteligentny session and every /powtorka
 * batch. Mixing the two was the old bug: "Nie znam" on a brand-new word is the
 * expected answer, and folding it into one ratio made a session's signal a
 * function of its own composition rather than of the learner.
 *
 * Two loops read this scalar, deliberately at different speeds so they can't
 * chase each other into oscillation:
 *
 *  - `reviewRatioFor`      — fast. How much of today's Inteligentny session is
 *                            review rather than new words. Moves every session.
 *  - `requestRetentionFor` — slow. The FSRS desired-retention knob, i.e. how
 *                            far apart words come back. Small steps, tight
 *                            bounds, and a dead zone so an ordinary week never
 *                            moves it at all.
 *
 * ── On TARGET being 0.85, not 0.90 ──────────────────────────────────────────
 * This is NOT the same quantity as REQUEST_RETENTION, and the two must not be
 * conflated. `value` is measured on the words the queue actually served, and
 * when the daily serving is capped `orderDueWords` serves the most decayed ones
 * first (W_DECAY / W_CRITICAL). So the sample is biased downward: a learner
 * whose true retention sits at the scheduler's 0.90 will measure below it here.
 * TARGET is the calibrated baseline of *this biased measurement* — the value at
 * which both loops sit exactly on today's behaviour. It is a starting estimate,
 * not a derived constant: worth re-fitting once there's real data.
 */

export interface ReviewHealth {
  /** EWMA of recall on scheduled reviews (0–1), or null before the first batch. */
  value: number | null
  /** Review cards folded in so far. Both loops stay asleep below MIN_SAMPLES. */
  samples: number
  /** Day key of the last fold — an abandoned signal goes stale rather than
   *  steering the scheduler off month-old evidence. */
  updatedAt: string | null
}

export interface ReviewOutcome {
  /** Scheduled-review cards that got a Znam/Nie znam verdict. */
  rated: number
  /** …of which answered "Znam". */
  known: number
}

export const EMPTY_REVIEW_HEALTH: ReviewHealth = { value: null, samples: 0, updatedAt: null }

export const HEALTH = {
  /** Measured recall at which both loops leave today's behaviour untouched. */
  TARGET: 0.85,
  /** EWMA weight of one full-size batch. */
  GAIN: 0.3,
  /** Batch size that carries the full GAIN; smaller batches count for less. */
  FULL_BATCH: 10,
  /** Below this a batch is noise, not evidence — it's dropped entirely. */
  MIN_BATCH: 4,
  /** Review cards needed before the loops engage at all. */
  MIN_SAMPLES: 20,
  /** No reviews for this long → fall back to baseline rather than steer on
   *  stale evidence. */
  STALE_DAYS: 30,
  /** Deviation from TARGET that counts as "an ordinary week" — nothing moves. */
  DEAD_ZONE: 0.02,

  // ── Loop A: session mix ──────────────────────────────────────────────────
  /** Review share moves this much per point of deviation from TARGET. */
  RATIO_GAIN: 2.0,
  /** Even a flawless run keeps this much review — a good streak is not a
   *  reason to stop maintaining. */
  RATIO_MIN: 0.2,
  /** …and a bad one never turns the session into pure review; new words are
   *  why the learner is here. */
  RATIO_MAX: 0.65,
  /** Below this, stretch words are dropped whatever comfort says: piling the
   *  hardest new material on top of a memory that's already slipping is the
   *  worst thing the mode could do. */
  STRETCH_FLOOR: 0.75,

  // ── Loop B: interval length ──────────────────────────────────────────────
  /** Desired retention moves this much per point of deviation from TARGET. */
  RR_GAIN: 0.3,
  /** Floor = longest intervals (~1.4× today's). Deliberately far short of what
   *  FSRS permits (0.7): longer intervals are an asymmetric bet — they pay a
   *  little time back now and cost a lot if the learner disappears for a month. */
  RR_MIN: 0.86,
  /** Ceiling = shortest intervals (~0.56× today's). */
  RR_MAX: 0.94,
} as const

/** How the signal reads, for copy. `null` = not enough evidence to say. */
export type HealthTone = 'strong' | 'steady' | 'slipping'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Fold one batch of scheduled reviews into the EWMA.
 *
 * Weighted by batch size, so a 4-card tail-end batch doesn't move the number as
 * far as a full /powtorka run. The first batch seeds `value` outright — it's a
 * real measurement, and MIN_SAMPLES keeps it from being acted on until a few
 * more have landed.
 */
export function updateReviewHealth(
  prev: ReviewHealth,
  outcome: ReviewOutcome,
  now: Date = new Date()
): ReviewHealth {
  if (outcome.rated < HEALTH.MIN_BATCH) return prev
  const ratio = clamp(outcome.known / outcome.rated, 0, 1)
  const alpha = HEALTH.GAIN * Math.min(1, outcome.rated / HEALTH.FULL_BATCH)
  return {
    value: prev.value == null ? ratio : clamp(prev.value + (ratio - prev.value) * alpha, 0, 1),
    samples: prev.samples + outcome.rated,
    updatedAt: dayKey(now),
  }
}

/** The signal, or null while it's too thin or too old to steer anything. */
export function healthValue(h: ReviewHealth, now: Date = new Date()): number | null {
  if (h.value == null || h.samples < HEALTH.MIN_SAMPLES) return null
  if (h.updatedAt != null && daysBetween(h.updatedAt, dayKey(now)) > HEALTH.STALE_DAYS) return null
  return h.value
}

/** Signed distance from TARGET, or null — positive means "slipping". */
function deviation(h: ReviewHealth, now?: Date): number | null {
  const v = healthValue(h, now ?? new Date())
  if (v == null) return null
  const dev = HEALTH.TARGET - v
  // The epsilon keeps a value sitting exactly on the dead-zone edge inside it:
  // both sides are sums of decimal literals, so 0.85 + 0.02 lands a float tick
  // past 0.87 and would otherwise escape the zone the boundary defines.
  return Math.abs(dev) <= HEALTH.DEAD_ZONE + 1e-9 ? 0 : dev
}

/**
 * Share of an Inteligentny session to spend on review, given how review is
 * actually going. `base` is the unadapted default (SMART.REVIEW_RATIO).
 *
 * `urgent` is the backlog override: a good streak is allowed to buy more new
 * words, but not while the queue is already falling behind — otherwise a strong
 * month quietly builds the pile that collapses the month after.
 */
export function reviewRatioFor(
  h: ReviewHealth,
  opts: { base: number; urgent?: boolean; now?: Date }
): number {
  if (!ADAPTIVE_MIX_ENABLED) return opts.base
  const dev = deviation(h, opts.now)
  if (dev == null || dev === 0) return opts.base
  const ratio = clamp(opts.base + dev * HEALTH.RATIO_GAIN, HEALTH.RATIO_MIN, HEALTH.RATIO_MAX)
  return opts.urgent ? Math.max(ratio, opts.base) : ratio
}

/** Whether the session may weave in harder "stretch" words at all. */
export function allowStretch(h: ReviewHealth, now?: Date): boolean {
  if (!ADAPTIVE_MIX_ENABLED) return true
  const v = healthValue(h, now ?? new Date())
  return v == null || v >= HEALTH.STRETCH_FLOOR
}

/**
 * Desired retention for the FSRS scheduler — the personal version of
 * REQUEST_RETENTION. Higher = words come back sooner.
 *
 * Takes effect only on words graded after it changes; dates already on the
 * calendar are left alone, so the schedule shifts over a cycle rather than in
 * one jump.
 */
export function requestRetentionFor(h: ReviewHealth, now?: Date): number {
  if (!ADAPTIVE_RETENTION_ENABLED) return REQUEST_RETENTION
  const dev = deviation(h, now)
  if (dev == null || dev === 0) return REQUEST_RETENTION
  return clamp(REQUEST_RETENTION + dev * HEALTH.RR_GAIN, HEALTH.RR_MIN, HEALTH.RR_MAX)
}

/** Coarse reading of the signal, for the start card's subline. */
export function healthTone(h: ReviewHealth, now?: Date): HealthTone | null {
  const v = healthValue(h, now ?? new Date())
  if (v == null) return null
  if (v >= HEALTH.TARGET + 0.05) return 'strong'
  if (v <= HEALTH.TARGET - 0.05) return 'slipping'
  return 'steady'
}
