import { Word } from '../../types/vocabulary'
import { StudyMode } from '../../types/progress'
import './FlashCard.css'

interface Props {
  word: Word
  revealStep: number
  mode: StudyMode
  onClick: () => void
}

export function FlashCard({ word, revealStep, mode, onClick }: Props) {
  const isAutoplay = mode === 'autoplay'
  // Reveal order: Polish(0) → English(1) → sentence PL(2) → sentence EN(3)
  const showEnglish = revealStep >= 1 || isAutoplay
  const showSentencePl = revealStep >= 2 || isAutoplay
  const showSentenceEn = revealStep >= 3 || isAutoplay

  return (
    <div className={`flashcard animate-card`} onClick={onClick}>
      <div className="flashcard__polish">
        {word.polish}
      </div>

      {showEnglish && (
        <>
          <div className="flashcard__divider animate-reveal-fade" />
          <div className="flashcard__english animate-reveal-fade">
            {word.english}
          </div>
        </>
      )}

      {!showEnglish && (
        <>
          <div className="flashcard__divider flashcard__divider--hint" />
          <div className="flashcard__hint">
            Dotknij, aby odsłonić
          </div>
        </>
      )}

      {word.sentencePl && showSentencePl && (
        <div className="flashcard__sentence-pl animate-reveal-fade">
          {word.sentencePl}
        </div>
      )}

      {word.sentenceEn && showSentenceEn && (
        <div className="flashcard__sentence-en animate-reveal-fade">
          {word.sentenceEn}
        </div>
      )}
    </div>
  )
}
