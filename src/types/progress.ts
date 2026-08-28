export type WordStatus = 'new' | 'learning' | 'known'
export type StudyMode = 'fiszki' | 'autoplay'
export type AutoplayMode = 'fast' | 'standard' | 'speaking'
/** Which Trenuj exercise a `mode: 'fiszki'` session was. `review` is the
 *  cross-pack review queue rather than a single pack. Optional because
 *  sessions written before this field existed don't have it. */
export type TrainMode = 'word-flash' | 'active-sentence' | 'review'

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
}

export interface PackageProgress {
  packageId: string
  startedAt: string
  completedAt: string | null    // last time all cards were played through
  masteredAt: string | null     // time when all words were marked 'known'
  currentIndex: number
}

export interface DayActivity {
  date: string
  count: number
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
