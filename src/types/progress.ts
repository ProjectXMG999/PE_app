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
  completedAt: string | null
  currentIndex: number
}

export interface DayActivity {
  date: string
  count: number
}
