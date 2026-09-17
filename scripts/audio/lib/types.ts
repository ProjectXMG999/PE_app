export interface Word {
  id: string
  english: string
  polish: string
  polishAudio?: string
  sentenceEn: string | null
  sentencePl: string | null
  audioWord: string
  audioSentence: string
  audioWordPl?: string
  audioSentencePl?: string
  sentenceAudio?: boolean
}
export interface Pack { id: string; name: string; words: Word[] }

export type ClipKind = 'en-word' | 'pl-word' | 'en-sentence' | 'pl-sentence'

export interface ClipTask {
  kind: ClipKind
  packId: string
  wordId: string
  text: string
  voiceId: string
  voiceName: string
  outFile: string // relative to audio-output/<packId>/
}

export interface CheckpointRecord {
  wordId: string
  kind: ClipKind
  outFile: string
  textHash: string
  ok: boolean
  ts: string
}
