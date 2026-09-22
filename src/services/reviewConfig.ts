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
 *     as a ceiling, measured study time as the reality check, and the backlog
 *     itself as a floor (arrears spread over DEBT_HORIZON_DAYS).
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
/** Target retrievability the scheduler aims for when picking the next interval.
 *  The baseline: `requestRetentionFor` (services/reviewHealth.ts) moves a given
 *  learner off it, within tight bounds, once there's enough review evidence. */
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

// ── Pierwsze "Znam" na słowie widzianym pierwszy raz ────────────────────────
// A card is a self-report: prompt, attempt, reveal, verdict. On a word the app
// has never shown before, "Znam" does not mean "I just learned this" — it means
// "I knew this before you showed it to me", and it was said after a real
// attempt at recall. FSRS's GOOD (S₀≈3.13, three days) encodes the first of
// those, which is why an untouched bulk declaration used to outrank an answered
// card: 15 days for the gesture that proves nothing, 3 for the one that proves
// something. This is the second-to-last rung of the legacy REVIEW_LADDER.
//
// The schedule this seeds is deliberately long; what it does NOT do is claim a
// measured memory strength. That distinction is `assertedKnownAt` — see
// WordProgress and `retentionBreakdown` (reviewQueue.ts).
export const FIRST_KNOWN_STABILITY = 100
/** Same number as BULK_KNOWN_DIFFICULTY, and that is fine — but the PAIR must
 *  stay distinct. `isDeclaredKnownWord` (review.ts) fingerprints pre-flag rows
 *  as (reviewCount 0, stability, difficulty) === (0, BULK_KNOWN_*), so
 *  FIRST_KNOWN_STABILITY must never be equal to BULK_KNOWN_STABILITY: an
 *  organically answered word would then be read as a declaration and silently
 *  dropped from points. */
export const FIRST_KNOWN_DIFFICULTY = 4.5

// ── Level mastery ("Oznacz cały poziom jako opanowany") ─────────────────────
/** pack-content fetch concurrency while marking a level — level 4 alone is
 *  335 packs against an authenticated, per-pack Netlify function with no
 *  batch endpoint, so an unbounded Promise.all would fire 335 at once. */
export const LEVEL_MASTERY_FETCH_CONCURRENCY = 6

// ── Daily serving budget ────────────────────────────────────────────────────
// budget = min(goalDerived, max(timeDerived, debtFloor, PACE_FLOOR)), floored at
//          SERVING_MIN and bounded by SERVING_DAY_MAX.
//
//   goalDerived = round(goalMinutes    * perMinute)  ← the ceiling: the day's goal
//   timeDerived = round(activeDayMins  * perMinute)  ← how long they actually sit down for
//   perMinute   = 60 / secPerCard                    ← the learner's measured review pace
//   debtFloor   = min(goalDerived, ceil(backlog / DEBT_HORIZON_DAYS))  ← the arrears
//
// Two things the previous model got wrong, both visible on the first screen.
//
// It measured the reality check as *words completed* over the last 7 days — but
// a review session writes `wordsCompleted = cardCount`, which is exactly what
// the budget just allowed. The budget therefore measured itself: simulated over
// 60 days, a learner clearing their serving on 4 days a week stayed pinned to
// SERVING_MIN forever, because the only way to demonstrate a higher pace was to
// be granted a higher budget first. `activeDayMinutes` breaks the loop by
// reading the dailyTime ledger instead — seconds actually studied, which no
// budget caps — and by averaging over days with real study rather than over all
// 7, so two solid sessions a week no longer read as "pace 5".
//
// And the backlog appeared nowhere in the formula at all, so the learner
// furthest behind got the smallest serving: a 60-minute goal with 316 words due
// served eight of them. `debtFloor` amortises the arrears over
// DEBT_HORIZON_DAYS — bounded by the goal, so it can never promise more than
// the day can hold, and computed straight from the backlog rather than from
// `reviewUrgency` (which is itself derived from the budget, and would close the
// loop the wrong way round).
//
// The rate itself was the third thing it got wrong, and the most visible: at
// REVIEWS_PER_MINUTE = 1.2 a review card took 50 seconds. Nothing measured that
// — a card is a flip, the word's audio, and a Znam/Nie znam, which real
// sessions run in well under ten. Two consequences met on the same screen: 88
// due words were announced as "ok. 73 min", and a 10-minute goal derived a
// serving of 12, finished inside two minutes, while the queue behind it grew.
// The rate is now seconds per card, measured from the learner's own review
// sessions (`reviewSecPerCard`) with REVIEW_SEC_PER_CARD as the cold start.
/** Cold-start seconds for one review card — flip, audio, verdict. Used until
 *  the learner's own review sessions carry enough evidence to replace it. */
export const REVIEW_SEC_PER_CARD = 10
/** Reviews per minute at the cold-start pace. Derived, never tuned on its own:
 *  seconds per card is the quantity sessions actually measure. */
export const REVIEWS_PER_MINUTE = 60 / REVIEW_SEC_PER_CARD
/** Evidence thresholds and sanity bounds for the MEASURED pace. The bounds are
 *  what keep a clock artefact out of the budget: a tab left open behind a
 *  finished session, or a card "answered" in a hundred milliseconds. */
export const REVIEW_PACE = {
  /** Only recent sessions — pace changes as the queue's material changes. */
  WINDOW_DAYS: 60,
  /** Review cards needed in the window before the measurement beats the default. */
  MIN_CARDS: 30,
  /** Per-session floors: a 2-card stub with a 5-minute clock is a phone put
   *  down, not a pace. */
  MIN_SESSION_CARDS: 4,
  MIN_SESSION_SEC: 20,
  MIN_SEC: 4,
  MAX_SEC: 40,
} as const
export const SERVING_MIN = 8
/** Absolute sanity bound on a day's serving. `goalDerived` is the real ceiling
 *  (360 at the largest goal option and the cold-start pace), so this is not
 *  expected to bind — it exists so a corrupted goal or ledger can't produce an
 *  unbounded queue. Raised from 120 with the pace fix: at 50 s a card, 120 was
 *  double the largest goal's worth and never bound; at a real pace it would
 *  have quietly capped a 60-minute goal at 20 minutes of reviews. */
export const SERVING_DAY_MAX = 400
/** Never drop below this, whatever the measured time says — a returning learner
 *  isn't stuck at zero. */
export const PACE_FLOOR = 6
/** Days the current backlog is spread over by `debtFloor`. */
export const DEBT_HORIZON_DAYS = 14
/** Study-time window `activeDayMinutes` averages over. Longer than the old
 *  7-day pace window: one quiet week should bend the budget, not zero it. */
export const ACTIVE_WINDOW_DAYS = 14
/** Seconds in a day below which it isn't a study day at all — an app opened and
 *  closed shouldn't drag the average down. */
export const ACTIVE_DAY_MIN_SEC = 60
/** When the window holds no study day at all but the ledger does, fall back to
 *  the most recent this many study days, however old. A learner returning after
 *  a break is not a learner with no history: "no evidence" hands the budget the
 *  full goal, which would greet them with the largest serving the app can make
 *  on their first day back. Their own past sittings are a far better estimate. */
export const ACTIVE_FALLBACK_DAYS = 5
/** false → the backlog stops raising the floor, i.e. the budget is goal-and-time
 *  only. The one genuinely new term in the model, so it gets the rollback. */
export const DEBT_FLOOR_ENABLED = true

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
/** Gates loop A of review health (services/reviewHealth.ts): the Inteligentny
 *  session's review/new split, and the stretch cut-off, follow measured recall.
 *  false → REVIEW_RATIO stays the fixed 0.35 and stretch is comfort-only. */
export const ADAPTIVE_MIX_ENABLED = true
/** Gates loop B of review health: per-learner desired retention in place of the
 *  fixed REQUEST_RETENTION. false → every learner gets 0.9, as before. This is
 *  the one that writes to the schedule, so it's the one to flip first if the
 *  calibration turns out wrong. */
export const ADAPTIVE_RETENTION_ENABLED = true
