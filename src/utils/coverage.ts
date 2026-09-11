/**
 * Lexical coverage — what your vocabulary actually buys you.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * "1 221 / 10 000" measures distance to the end of a list: 12%, and it goes
 * down in spirit the more honest it gets. But those 1 221 are not a random
 * twelfth of English — they are the 1 221 *most useful* words, and frequency
 * distribution in language is brutally skewed. Someone who knows the first
 * thousand words understands most of an ordinary conversation.
 *
 * So the headline stops being a fraction of a chore and becomes a statement of
 * capability, which is what the product actually promises: "Dogadasz się
 * w podróży" at 1 000, "Powiesz, co myślisz, na spotkaniu" at 3 000.
 *
 * ── What is honest about this, and what is not ───────────────────────────────
 * This is an ESTIMATE and must always be labelled as one. Three assumptions:
 *
 *  1. The route order approximates usefulness order. That is the product's own
 *     central claim (the source data carries a strictly monotonic `Lp` from
 *     1 to 11 413), not something this module invents.
 *  2. Published coverage figures are for word *families* over a corpus; we
 *     count individual known words in one curriculum. Close, not identical.
 *  3. Coverage depends on register — everyday speech is covered far faster
 *     than academic writing. The anchors below describe ordinary spoken and
 *     everyday written language.
 *
 * The anchors are placed to agree with the four stations the product already
 * promises (`LEVEL_META`), so the number never contradicts the copy. Rounded
 * hard and always rendered with "~", because a decimal point here would be a
 * false claim to precision. The scientific section of the landing sets the
 * standard this has to meet: "pokazuj postęp uczciwie".
 *
 * Sources the landing already cites: Nation, Schmitt, Webb (BNC/COCA
 * frequency & lexical-coverage research).
 */

export interface CoverageAnchor {
  words: number
  /** Share (0–100) of running speech covered at this vocabulary size. */
  pct: number
}

/**
 * Coverage curve for ordinary spoken/everyday language, keyed to the
 * curriculum's own milestones. Deliberately conservative at the top: the last
 * thousands buy precision and nuance, not raw comprehension.
 */
export const COVERAGE_CURVE: CoverageAnchor[] = [
  { words: 0, pct: 0 },
  { words: 100, pct: 45 },
  { words: 500, pct: 68 },
  { words: 1000, pct: 80 },   // Survival English
  { words: 2000, pct: 89 },
  { words: 3000, pct: 93 },   // Everyday English
  { words: 6000, pct: 97 },   // Freedom English
  { words: 10000, pct: 98 },  // World-Class English
]

/**
 * Estimated share of everyday speech your known vocabulary covers.
 *
 * Piecewise-linear between anchors. Linear interpolation (rather than a fitted
 * log curve) is deliberate: it cannot overshoot an anchor, so the number can
 * never disagree with the station promises the user has already been shown.
 */
export function coverageFor(knownWords: number): number {
  const w = Math.max(0, knownWords)
  const last = COVERAGE_CURVE[COVERAGE_CURVE.length - 1]
  if (w >= last.words) return last.pct

  for (let i = 1; i < COVERAGE_CURVE.length; i++) {
    const b = COVERAGE_CURVE[i]
    if (w > b.words) continue
    const a = COVERAGE_CURVE[i - 1]
    const span = b.words - a.words
    const t = span > 0 ? (w - a.words) / span : 0
    return a.pct + (b.pct - a.pct) * t
  }
  return last.pct
}

/** Rounded for display. Never sub-integer — see the honesty note above. */
export function coveragePct(knownWords: number): number {
  return Math.round(coverageFor(knownWords))
}

/**
 * How much coverage the next `n` words are worth, in percentage points.
 *
 * This is the number that makes the early route feel valuable and the late
 * route feel like polish — and it is the honest answer to "why is the order
 * the whole product".
 */
export function coverageGain(knownWords: number, n = 100): number {
  return coverageFor(knownWords + n) - coverageFor(knownWords)
}

/**
 * Words needed to reach a target coverage, or null when already there.
 * Walks the curve rather than inverting it, so it stays exact at the anchors.
 */
export function wordsForCoverage(targetPct: number): number | null {
  if (targetPct <= 0) return 0
  const last = COVERAGE_CURVE[COVERAGE_CURVE.length - 1]
  if (targetPct > last.pct) return null

  for (let i = 1; i < COVERAGE_CURVE.length; i++) {
    const b = COVERAGE_CURVE[i]
    if (targetPct > b.pct) continue
    const a = COVERAGE_CURVE[i - 1]
    const span = b.pct - a.pct
    const t = span > 0 ? (targetPct - a.pct) / span : 0
    return Math.round(a.words + (b.words - a.words) * t)
  }
  return last.words
}
