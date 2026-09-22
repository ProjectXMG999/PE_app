import { ReactNode } from 'react'
import { StageSentence } from '../components/flashcard/StudyStage'
import { hasSentenceAudioEn, hasSentenceAudioPl } from '../audio/sentenceAudio'
import { Word } from '../types/vocabulary'

interface SentenceAudio {
  stop: (opts?: { hard?: boolean }) => void
  playSentence: (word: Word) => Promise<'ok' | 'timeout' | 'error'>
  playSentencePl: (word: Word) => Promise<'ok' | 'timeout' | 'error'>
  playWordPl: (word: Word) => Promise<'ok' | 'timeout' | 'error'>
}

export interface SentenceCardProps {
  onPlayPolish: (() => void) | undefined
  frontExtra: ReactNode
  backExtra: ReactNode
  frontHint: string | undefined
}

/**
 * StudyStage props that switch a plain flashcard to the "with sentence"
 * layout, when — and only when — this word actually carries a context
 * sentence. Shared by every mode that can show one (Active Sentence and
 * Inteligentny). A word with no sentence data gets all-undefined back, so
 * StudyStage renders exactly as it does today.
 */
export function useSentenceCardProps(
  word: Word | null | undefined,
  audio: SentenceAudio
): SentenceCardProps {
  const hasSentencePl = !!word?.sentencePl
  const hasSentenceEn = !!word?.sentenceEn

  return {
    onPlayPolish: word ? () => { audio.stop(); audio.playWordPl(word) } : undefined,
    frontExtra: hasSentencePl && word ? (
      <StageSentence
        text={word.sentencePl!}
        onPlay={hasSentenceAudioPl(word)
          ? () => { audio.stop(); audio.playSentencePl(word) }
          : undefined}
        label="Wymowa zdania po polsku"
      />
    ) : undefined,
    backExtra: hasSentenceEn && word ? (
      <StageSentence
        text={word.sentenceEn!}
        onPlay={hasSentenceAudioEn(word)
          ? () => { audio.stop(); audio.playSentence(word) }
          : undefined}
        label="Wymowa zdania po angielsku"
      />
    ) : undefined,
    frontHint: hasSentencePl ? 'Powiedz po angielsku całe zdanie. Potem odsłoń.' : undefined,
  }
}
