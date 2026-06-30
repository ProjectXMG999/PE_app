export type WordStatus = 'new' | 'learning' | 'known'
export type StudyMode = 'fiszki' | 'autoplay'

export interface Session {
  id?: number
  packageId: string
  date: string
  wordsCompleted: number
  mode: StudyMode
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
