export interface WordTask {
  id: string
  english: string
  polish: string
  category: string
  level: number
  packId: string
  packName: string
}

export interface SentenceCandidate {
  sentenceEn: string
  sentencePl: string
}

// One row per word, 6 sentence columns (3 candidate EN/PL pairs) plus the
// context needed to re-join this row against a copy of the master word
// database later (see export-candidates-master.ts). `id` is the primary,
// unique join key (matches the pack word id used everywhere else in the
// app); english/polish/packId/packName/category/level are carried along so
// a row is still identifiable by eye, or joinable by (packName, category,
// english) if a given export ever lacks the id column.
export interface CheckpointRecord {
  id: string
  english: string
  polish: string
  packId: string
  packName: string
  category: string
  level: number
  candidate1En: string
  candidate1Pl: string
  candidate2En: string
  candidate2Pl: string
  candidate3En: string
  candidate3Pl: string
  model: string
  generatedAt: string
}
