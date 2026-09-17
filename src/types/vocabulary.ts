export interface Word {
  id: string
  english: string
  /** Full translation as in the word database, e.g. "Móc; umieć; potrafić" — what the learner sees. */
  polish: string
  /**
   * Short spoken form used to record the Polish word audio ("Móc"): first
   * meaning only, no parenthesised notes. Absent on older data, where
   * `polish` itself was already the short form.
   */
  polishAudio?: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioSentence: string
  audioWordPl?: string
  audioSentencePl?: string
  /**
   * True only when the sentence mp3s (audioSentence / audioSentencePl) were
   * recorded for the CURRENT sentence text. Sentences get rewritten
   * independently of audio, and the old recordings keep their file names —
   * without this flag the app would play an old recording under a new
   * sentence. Absent = don't play sentence audio.
   */
  sentenceAudio?: boolean
}

export interface PackMeta {
  id: string
  name: string
  volume: string
  level: number
  category: string
  wordCount: number
  chapter: string
}

export interface Pack extends PackMeta {
  words: Word[]
}
