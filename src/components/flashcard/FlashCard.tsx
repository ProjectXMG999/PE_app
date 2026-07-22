import { Word } from '../../types/vocabulary'
import { StudyMode } from '../../types/progress'
import './FlashCard.css'

interface Props {
  word: Word
  revealStep: number
  mode: StudyMode
  onClick: () => void
  // Autoplay: which line is currently being spoken (0=PL, 1=EN, 2=PL sentence, 3=EN sentence)
  activeLine?: 0 | 1 | 2 | 3 | null
}

export function FlashCard({ word, revealStep, mode, onClick, activeLine = null }: Props) {
  const isAutoplay = mode === 'autoplay'
  // Reveal order: Polish(0) → English(1) → sentence PL(2) → sentence EN(3)
  const showEnglish = revealStep >= 1 || isAutoplay
  const showSentencePl = revealStep >= 2 || isAutoplay
  const showSentenceEn = revealStep >= 3 || isAutoplay

  const lineClass = (line: 0 | 1 | 2 | 3) =>
    activeLine === line ? ' flashcard__line--active' : ''

  return (
    <div className={`flashcard animate-card`} onClick={onClick}>
      <div className={`flashcard__polish${lineClass(0)}`}>
        {word.polish}
      </div>

      {showEnglish && (
        <>
          <div className="flashcard__divider" />
          <div className={`flashcard__english animate-slide-up${lineClass(1)}`}>
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
        <div className={`flashcard__sentence-pl animate-slide-up${lineClass(2)}`}>
          {word.sentencePl}
        </div>
      )}

      {word.sentenceEn && showSentenceEn && (
        <div className={`flashcard__sentence-en animate-slide-up${lineClass(3)}`}>
          {word.sentenceEn}
        </div>
      )}
    </div>
  )
}
