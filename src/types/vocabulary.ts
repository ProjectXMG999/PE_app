export interface Word {
  id: string
  english: string
  polish: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioSentence: string
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
