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
  const showPolish = revealStep >= 1 || mode === 'autoplay'
  const showSentenceEn = revealStep >= 2 || mode === 'autoplay'
  const showSentencePl = revealStep >= 3 || mode === 'autoplay'

  return (
    <div className={`flashcard animate-card`} onClick={mode === 'fiszki' ? onClick : undefined}>
      <div className="flashcard__english">
        {word.english}
      </div>

      {showPolish && (
        <>
          <div className="flashcard__divider" />
          <div className="flashcard__polish animate-slide-up">
            {word.polish}
          </div>
        </>
      )}

      {!showPolish && (
        <>
          <div className="flashcard__divider flashcard__divider--hint" />
          <div className="flashcard__hint">
            Dotknij, aby odsłonić
          </div>
        </>
      )}

      {word.sentenceEn && showSentenceEn && (
        <div className="flashcard__sentence-en animate-slide-up">
          {word.sentenceEn}
        </div>
      )}

      {word.sentencePl && showSentencePl && (
        <div className="flashcard__sentence-pl animate-slide-up">
          {word.sentencePl}
        </div>
      )}
    </div>
  )
}
