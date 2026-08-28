/**
 * Every tunable knob and feature flag for the review system, in one place.
 * No logic lives here — see fsrs.ts / reviewQueue.ts for the pure functions that
 * use these, and review.ts for the per-word state machine.
 *
 * The model, end to end:
 *  1. Each word carries `stability` / `difficulty` (FSRS, fsrs.ts). A recall
 *     grows stability; a lapse shrinks it. The next interval is chosen so recall
 *     probability decays to REQUEST_RETENTION. (Behind FSRS_ENABLED; the legacy
 *     REVIEW_LADDER path runs when it's off and seeds the first stability.)
 *  2. Once stability crosses RETIRE_STABILITY_DAYS the word is "retired" — it
 *     keeps a real (long, ~yearly) nextReviewAt so a forgotten word is still
 *     eventually caught. Any lapse un-retires.
 *  3. Each day only a *serving* of the backlog is shown: budget = the time goal
 *     as a ceiling, the recent 7-day pace as the reality check.
 *  4. When the serving is capped, words are ordered by PRIORITY (mostly
 *     1 − retrievability), with an anti-starvation override.
 *  5. Freshness / clean-streak count only genuinely neglected words, and the
 *     clean-streak reads a real per-day ledger.
 */

// ── Interval ladder (days), indexed by reviewCount ───────────────────────────
// LEGACY: used only on the pre-FSRS path (`!FSRS_ENABLED`) and as the seed for
// fsrs.seedFromLadder — a word's rung maps to a starting `stability`.
export const REVIEW_LADDER = [3, 8, 20, 45, 100, 240]
/** Legacy (pre-FSRS) graduation threshold on `reviewCount`. */
export const RETIRE_AT_REVIEW_COUNT = 5

// ── FSRS scheduler (src/services/fsrs.ts) ───────────────────────────────────
/** Target retrievability the scheduler aims for when picking the next interval. */
export const REQUEST_RETENTION = 0.9
/** Published FSRS-4.5 population defaults. NOT optimised per user. */
export const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567,
] as const
export const FSRS_MIN_INTERVAL = 1
/** Deep-maintenance cap — a durable word still recurs ~every 1-2 years, never "gone". */
export const FSRS_MAX_INTERVAL = 730
/** Cohort-spread on nextReviewAt: ± this fraction of the interval. */
export const FUZZ_FACTOR = 0.08
/** Stability (days) at/above which a word is "retired" — leaves the daily grind
 *  but keeps a real (long) nextReviewAt so forgetting is still eventually caught. */
export const RETIRE_STABILITY_DAYS = 365

// ── "Znam wszystko" (bulk-mark from the pack preview) ───────────────────────
// The user asserts they already knew this vocabulary well (that's why they're
// filling it in fast). Such words enter the review queue a couple of levels in,
// not at the 3-day first rung like something just studied.
export const BULK_KNOWN_STABILITY = 15      // FSRS: first check in ~2 weeks
export const BULK_KNOWN_DIFFICULTY = 4.5    // a touch easier than the study default (~5.3)
export const BULK_KNOWN_REVIEW_COUNT = 2    // legacy ladder: rung 2 → intervalFor(2) = 20 days

// ── Daily serving budget ────────────────────────────────────────────────────
// 'pace' (current): budget = clamp(min(goalDerived, max(paceDerived, PACE_FLOOR)), MIN, MAX)
//   goalDerived = round(goalMinutes * REVIEWS_PER_MINUTE)   ← the ceiling
//   paceDerived = round(recentPace7d * PACE_HEADROOM)       ← the reality check
// 'flex' (legacy, kept for quick rollback): goalDerived + min(SERVING_FLEX_CAP, floor(knownTotal / SERVING_FLEX_DIVISOR))
export const BUDGET_MODE: 'pace' | 'flex' = 'pace'
export const REVIEWS_PER_MINUTE = 1.2
export const SERVING_MIN = 8
export const SERVING_MAX = 40
export const PACE_HEADROOM = 1.5 // you can sustain ~1.5× your recent words/day in review
export const PACE_FLOOR = 6 // …but never drop below this (a returning user isn't stuck at 0)
/** @deprecated legacy 'flex' budget mode only */
export const SERVING_FLEX_DIVISOR = 500
/** @deprecated legacy 'flex' budget mode only */
export const SERVING_FLEX_CAP = 12

// ── Priority weights (higher = served sooner) ───────────────────────────────
export const PRIORITY = {
  /** Per day overdue, before the cap. */
  overduePerDay: 1.0,
  /** Days-late is clamped to this before weighting. */
  overdueCap: 30,
  /** reviewCount <= 1 — freshly learned, easiest to lose. */
  fragileYoung: 6,
  /** reviewCount === 2 — still settling. */
  fragileMid: 3,
  /** lapseCount >= STRUGGLE_LAPSES — the user keeps missing this one. */
  struggle: 5,
  /** reviewCount >= 4 — nearly graduated, can wait. */
  nearGraduation: -4,
  /** pack.level < todayLevel — the user self-identified as past this tier. */
  belowLevel: -8,
} as const

/** Lapses before a word gets the priority bump. */
export const STRUGGLE_LAPSES = 2
/** Lapses before a due word turns the whole urgency indicator red. Deliberately
 *  higher than STRUGGLE_LAPSES: a nudge up the queue is not the same as an alarm. */
export const LEECH_LAPSES = 3

/** Anti-starvation: once a word is overdue past STALE_GRACE_DAYS it gets this
 *  bonus, big enough to dominate belowLevel / nearGraduation penalties so a
 *  genuinely-neglected word always surfaces regardless of level. */
export const W_NEGLECT = 25
/** The belowLevel penalty only applies while the word is still fresh — pre-FSRS
 *  measured in days overdue, under FSRS in retrievability (> 0.75). */
export const BELOW_LEVEL_GRACE_DAYS = 7

// ── Priority: FSRS retrievability terms (active once a word has `stability`) ──
/** Weight on decay = (1 − retrievability). A word at R=0.6 scores +16 here. */
export const W_DECAY = 40
/** Retrievability at/below which a word is "about to be forgotten". */
export const R_CRITICAL = 0.65
/** Bonus for a below-R_CRITICAL word — dominates every penalty (anti-starvation). */
export const W_CRITICAL = 50
/** Deep-maintenance (retired) words can wait — they're durable by definition. */
export const W_DEEP_MAINT = -6

// ── Urgency / freshness ─────────────────────────────────────────────────────
/** Overdue by more than this many days counts as genuine neglect — it feeds the
 *  urgency tier, freshnessPct and the clean-streak. Words below todayLevel are
 *  excluded from the neglect count only while still within STALE_GRACE_DAYS*2. */
export const STALE_GRACE_DAYS = 14

// ── Listening interludes inside the review run ──────────────────────────────
export const REVIEW_INTERLUDE_EVERY = 6 // one interlude per this many cards
export const REVIEW_INTERLUDE_SIZE = 4 // words per interlude
export const INTERLUDE_KNOWN_SLOTS = 1 // …of which this many are already-known/retired words
export const LISTEN_BELOW_RATIO = 0.5 // "not yet half learned" packs feed the interludes
export const LISTEN_MAX_PACKS = 4 // fetchPack ceiling for the interlude pool

// ── Feature flags ──────────────────────────────────────────────────────────
/** false → review.ts uses the legacy interval ladder. true → FSRS (fsrs.ts),
 *  seeding stability/difficulty lazily on the first answer per word.
 *  Enabled: the 0006 migration (stability/difficulty columns) is live on prod. */
export const FSRS_ENABLED = true
/** false → computeServingState returns budget = remaining = backlog (pre-budget behaviour). */
export const SERVING_ENABLED = true
/** Gates the retiredAt write path in review.ts (FSRS: stability >= RETIRE_STABILITY_DAYS).
 *  Enabled: the 0005 migration (retired_at column) is live on prod. */
export const GRADUATION_ENABLED = true
/** Gates listening-interlude splicing in useReviewSet. false → /powtorka is pure
 *  flashcards. Safe to flip once the checkpoint flow has been verified. */
export const REVIEW_INTERLUDES_ENABLED = false
