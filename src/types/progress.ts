// Each of these four unions is mirrored by a CHECK constraint in
// supabase/migrations, so each is declared as a const array with the type
// derived from it rather than the other way round. The arrays are what lets
// schema-drift.test.ts enumerate the variants at runtime and assert that the
// database still accepts every one of them.
//
// That test exists because this drifted once and cost real users a recurring
// "progress failed to sync" alarm: 'smart' was added to TrainMode below and
// written by the app, but no migration widened the CHECK, so every Inteligentny
// session was rejected forever. See migration 0010.

export const WORD_STATUSES = ['new', 'learning', 'known'] as const
export type WordStatus = typeof WORD_STATUSES[number]

export const STUDY_MODES = ['fiszki', 'autoplay'] as const
export type StudyMode = typeof STUDY_MODES[number]

export const AUTOPLAY_MODES = ['fast', 'standard', 'speaking'] as const
export type AutoplayMode = typeof AUTOPLAY_MODES[number]

/** Which Trenuj exercise a `mode: 'fiszki'` session was. `review` is the
 *  cross-pack review queue rather than a single pack; `smart` is the
 *  Inteligentny mode's mixed queue (also cross-pack). Optional because
 *  sessions written before this field existed don't have it. */
export const TRAIN_MODES = ['word-flash', 'active-sentence', 'review', 'smart'] as const
export type TrainMode = typeof TRAIN_MODES[number]

export interface Session {
  id?: number
  packageId: string
  /** Local-calendar day key (see utils/day.ts). Sorts lexicographically. */
  date: string
  /** Full ISO timestamp of when the session was saved. Optional because
   *  sessions written before this field existed don't have it. */
  startedAt?: string
  wordsCompleted: number
  mode: StudyMode
  /** Which autoplay sub-mode this session was played in (mode === 'autoplay' only). */
  autoplayMode?: AutoplayMode
  /** Which Trenuj exercise this was (mode === 'fiszki' only). */
  trainMode?: TrainMode
  /** Measured wall-clock seconds spent in this session. Optional: sessions
   *  written before this field existed fall back to the words × 8 s estimate. */
  durationSec?: number
  /** Cards that got a Znam/Nie znam verdict in this session (autoplay has none).
   *  Optional: sessions written before this field existed don't have it. */
  ratedCount?: number
  /** Of `ratedCount`, how many were answered "Znam". Together with `ratedCount`
   *  this is the session's success ratio — the raw signal the adaptive
   *  difficulty ("comfort level") is derived from. */
  knownHitCount?: number
}

export interface WordProgress {
  wordId: string
  packageId: string
  seenCount: number
  lastSeen: string
  /** `known` is PERMANENT — a word the user once mastered never drops back down,
   *  because the route count must never go backwards. Forgetting is tracked by
   *  the review fields below instead, which put the word back in the queue
   *  without touching this status. */
  status: WordStatus
  /** Times the word was re-confirmed after being mastered. */
  reviewCount?: number
  /** Times the user answered "Nie znam" on an already-mastered word. */
  lapseCount?: number
  lastLapseAt?: string
  /** Day key from which the word is due for review. Undefined = not scheduled. */
  nextReviewAt?: string
  /** ISO timestamp when the word left the active daily review grind. Pre-FSRS:
   *  reviewCount reached RETIRE_AT_REVIEW_COUNT (and nextReviewAt was cleared).
   *  FSRS: `stability` crossed RETIRE_STABILITY_DAYS — `nextReviewAt` stays set
   *  (deep maintenance, ~yearly). `status` stays 'known'. Cleared on any lapse. */
  retiredAt?: string
  /** FSRS memory strength in days (see src/services/fsrs.ts). undefined = word
   *  not yet migrated to FSRS; scheduler falls back to the interval ladder. */
  stability?: number
  /** FSRS intrinsic difficulty, 1..10. Paired with `stability`. */
  difficulty?: number
  /** ISO timestamp: `status: 'known'` was ASSERTED by a bulk declaration
   *  (per-pack "Znam wszystko" or a level-mastery mark) rather than earned by
   *  actually answering the word. Cleared the moment the word gets a real
   *  review/lapse (services/review.ts). Drives the "declaration, not effort"
   *  exclusion in points.ts / achievements.ts. */
  declaredKnownAt?: string
  /** ISO timestamp: `retiredAt` was forced by a level-mastery declaration
   *  rather than earned via durable FSRS stability. Only "Cofnij" (the level
   *  mastery snapshot) ever clears it — never touched by normal review flow,
   *  since a retired word never re-enters the queue while the level stays
   *  marked. */
  declaredRetiredAt?: string
}

/**
 * Three independent axes, three fields — what you HEARD, what you WORKED
 * THROUGH, and what you KNOW. They used to be two, and `currentIndex` was
 * quietly doing duty for all three: every "odsłuchane" figure in the app reads
 * it, but a Trenuj run, a "Znam wszystko" tap and a level declaration all wrote
 * it to the full word count, so declaring knowledge reported itself as
 * listening. Keep them separate; see services/listenAxis.ts for the one
 * function allowed to move the listen axis.
 */
export interface PackageProgress {
  packageId: string
  startedAt: string
  /** How far Słuchaj playback got — a resume pointer, nothing else. Only a
   *  real autoplay run may move it. */
  currentIndex: number
  /** When the pack was played through end to end in Słuchaj. The single
   *  source of "✓ Odsłuchana". Optional: rows written before this field
   *  existed don't have it, and listenRepair.ts backfills them from the
   *  session log. */
  listenedAt?: string | null
  /** Last time every card was worked through, in ANY mode (Słuchaj, fiszki or
   *  a Trenuj exercise) — "✓ Przerobiona". */
  completedAt: string | null
  /** When every word in the pack reached 'known' — "★ Opanowana". */
  masteredAt: string | null
}

// ── Level mastery ("Oznacz cały poziom jako opanowany") ─────────────────────
// The undo snapshot behind this feature is intentionally IndexedDB-local, not
// mirrored to Supabase — see services/db.ts / services/levelMastery.ts.

export interface LevelMasteryWordEntry {
  wordId: string
  packageId: string
  /** Exact prior row, or null if the word had no progress at all before marking. */
  prev: WordProgress | null
}

export interface LevelMasteryPackageEntry {
  packageId: string
  /** Exact prior row, or null if the package had no progress at all before marking. */
  prev: PackageProgress | null
}

export interface LevelMasterySnapshot {
  /** Primary key of the `levelMastery` store. */
  level: number
  markedAt: string
  words: LevelMasteryWordEntry[]
  packages: LevelMasteryPackageEntry[]
}

export interface DayActivity {
  date: string
  /** Words completed in finished sessions that day. */
  count: number
  /**
   * Seconds actually studied that day, from the daily-time ledger.
   *
   * Carried alongside `count` because a day can have real study and no finished
   * pack — which is how the rhythm heatmap used to show an empty month to a user
   * the app was simultaneously awarding "cel dnia" to. See utils/studyDays.
   */
  seconds: number
}

/**
 * Time studied on one local-calendar day, ticked every 30 s while a session is
 * running. Sessions only persist when a pack is finished, so without this an
 * abandoned session would leave no trace of the time actually spent.
 */
export interface DailyTime {
  /** Local-calendar day key — the store's primary key. */
  date: string
  secondsStudied: number
  /** The goal in force on that day, so history stays truthful if it changes. */
  goalSec: number
  /** ISO timestamp of the moment the goal was reached, or null. */
  goalMetAt: string | null
}

/**
 * One row per local-calendar day: was that day's review serving cleared?
 * Written live when `servingLeft` hits 0 (backlog empty or budget spent). A day
 * with no row = not cleared. `cleanDays` counts the consecutive run back from
 * today — a faithful, monotonic streak (unlike the old lastSeen estimate).
 */
export interface ReviewLedgerEntry {
  /** Local-calendar day key — the store's primary key. */
  date: string
  cleared: boolean
  /** ISO timestamp of the moment it was marked cleared. */
  clearedAt: string | null
}
