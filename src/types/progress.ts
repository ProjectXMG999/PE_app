export type WordStatus = 'new' | 'learning' | 'known'
export type StudyMode = 'fiszki' | 'autoplay'
export type AutoplayMode = 'fast' | 'standard' | 'speaking'

export interface Session {
  id?: number
  packageId: string
  date: string
  /** Full ISO timestamp of when the session was saved. Optional because
   *  sessions written before this field existed don't have it. */
  startedAt?: string
  wordsCompleted: number
  mode: StudyMode
  /** Which autoplay sub-mode this session was played in (mode === 'autoplay' only). */
  autoplayMode?: AutoplayMode
}

export interface WordProgress {
  wordId: string
  packageId: string
  seenCount: number
  lastSeen: string
  status: WordStatus
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
