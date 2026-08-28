/**
 * FSRS-4.5 scheduler — pure, no IO.
 *
 * Free Spaced Repetition Scheduler. Models each word with two numbers:
 *  - `stability` (S): days for retrievability to fall from 100% to REQUEST_RETENTION.
 *    The strength of the memory. Grows on success, shrinks on a lapse.
 *  - `difficulty` (D): 1..10, how intrinsically hard the word is. Higher D → S
 *    grows more slowly. Nudged toward the population mean on every review.
 *
 * Grades are binary here: "Nie znam" = AGAIN (1), "Znam" = GOOD (3). HARD/EASY
 * (2/4) are defined for a future "trudne / łatwe" split but unused.
 *
 * Weights `W` are the published FSRS-4.5 population defaults — NOT optimised per
 * user (that needs a review-log table + optimiser; separate project).
 *
 * The per-word state machine (`review.ts`) wraps these; `reviewConfig.ts` holds
 * the flag (`FSRS_ENABLED`) and the tunables re-exported below.
 */
import {
  W,
  REQUEST_RETENTION,
  FSRS_MIN_INTERVAL,
  FSRS_MAX_INTERVAL,
  FUZZ_FACTOR,
} from './reviewConfig'

export const AGAIN = 1
export const HARD = 2
export const GOOD = 3
export const EASY = 4
export type Grade = 1 | 2 | 3 | 4

const DECAY = -0.5
/** FACTOR = 0.9 ** (1/DECAY) - 1 = 19/81. With it, interval(S) === S at RR 0.9. */
const FACTOR = 19 / 81

const MIN_STABILITY = 0.1
const MAX_STABILITY = 36500

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Probability the word is still recallable `t` days after the last review. */
export function retrievability(t: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + (FACTOR * Math.max(0, t)) / stability, DECAY)
}

/** Days until retrievability decays to REQUEST_RETENTION for a given stability. */
export function nextInterval(stability: number): number {
  const raw = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1)
  return clamp(Math.round(raw), FSRS_MIN_INTERVAL, FSRS_MAX_INTERVAL)
}

// ── Difficulty ─────────────────────────────────────────────────────────────

function initialDifficulty(grade: Grade): number {
  return clamp(W[4] - Math.exp(W[5] * (grade - 1)) + 1, 1, 10)
}

function nextDifficulty(difficulty: number, grade: Grade): number {
  const delta = difficulty - W[6] * (grade - 3)
  // Mean-reversion toward the "easy" initial difficulty.
  const reverted = W[7] * initialDifficulty(EASY) + (1 - W[7]) * delta
  return clamp(reverted, 1, 10)
}

// ── Stability ──────────────────────────────────────────────────────────────

function recallStability(difficulty: number, stability: number, r: number, grade: Grade): number {
  const hardPenalty = grade === HARD ? W[15] : 1
  const easyBonus = grade === EASY ? W[16] : 1
  const s =
    stability *
    (1 +
      Math.exp(W[8]) *
        (11 - difficulty) *
        Math.pow(stability, -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) *
        hardPenalty *
        easyBonus)
  return clamp(s, MIN_STABILITY, MAX_STABILITY)
}

function forgetStability(difficulty: number, stability: number, r: number): number {
  const s =
    W[11] *
    Math.pow(difficulty, -W[12]) *
    (Math.pow(stability + 1, W[13]) - 1) *
    Math.exp((1 - r) * W[14])
  // A lapse must not increase stability.
  return clamp(Math.min(s, stability), MIN_STABILITY, MAX_STABILITY)
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface FsrsCard {
  stability: number
  difficulty: number
}

export interface FsrsResult {
  stability: number
  difficulty: number
  intervalDays: number
}

/** First-ever review of a word: seed S/D from the grade, return the first interval. */
export function initCard(grade: Grade): FsrsResult {
  const stability = clamp(W[grade - 1], MIN_STABILITY, MAX_STABILITY)
  const difficulty = initialDifficulty(grade)
  return { stability, difficulty, intervalDays: nextInterval(stability) }
}

/**
 * Review of a word that already has FSRS state.
 * `elapsedDays` — real days since the last review; clamped to >= 1 (same-day
 * re-reviews are treated as a 1-day gap; FSRS-4.5 has no short-term term).
 */
export function review(card: FsrsCard, grade: Grade, elapsedDays: number): FsrsResult {
  const t = Math.max(1, Math.round(elapsedDays))
  const r = retrievability(t, card.stability)
  const difficulty = nextDifficulty(card.difficulty, grade)
  const stability =
    grade === AGAIN
      ? forgetStability(difficulty, card.stability, r)
      : recallStability(difficulty, card.stability, r, grade)
  return { stability, difficulty, intervalDays: nextInterval(stability) }
}

/**
 * Seed FSRS state for an existing user whose word only has ladder bookkeeping
 * (`reviewCount` / `lapseCount`, no `stability`). The rung's interval is a decent
 * proxy for stability; past lapses raise difficulty. Feed the result to `review`.
 */
export function seedFromLadder(
  ladder: readonly number[],
  reviewCount: number | undefined,
  lapseCount: number | undefined
): FsrsCard {
  const rung = Math.min(reviewCount ?? 0, ladder.length - 1)
  return {
    stability: clamp(ladder[rung], MIN_STABILITY, MAX_STABILITY),
    difficulty: clamp(5.3 + (lapseCount ?? 0) * 0.8, 1, 10),
  }
}

/**
 * Spread same-day cohorts apart: return `intervalDays` nudged by a random amount
 * that grows with the interval. Always >= 1.
 */
export function applyFuzz(intervalDays: number, rng: () => number = Math.random): number {
  if (intervalDays < 2) return intervalDays
  const f = Math.max(1, Math.round(intervalDays * FUZZ_FACTOR))
  const offset = Math.floor(rng() * (2 * f + 1)) - f
  return Math.max(1, intervalDays + offset)
}
