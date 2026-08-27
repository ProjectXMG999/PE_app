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
