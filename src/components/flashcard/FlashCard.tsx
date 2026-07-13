import { useState, useEffect } from 'react'
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
  const [isInitial, setIsInitial] = useState(true)

  useEffect(() => {
    console.log('[flashcard] mount, word=', word.id)
    return () => console.log('[flashcard] unmount, word=', word.id)
  }, [word.id])

  useEffect(() => {
    console.log('[flashcard] isInitial=', isInitial, '→ animate-card will', isInitial ? 'APPLY' : 'NOT apply')
    if (!isInitial) {
      setIsInitial(false) // already false, but log that we skip re-animating
    }
  }, [isInitial])

  useEffect(() => {
    console.log('[flashcard] revealStep=', revealStep, 'word=', word.english)
    setIsInitial(false)
  }, [])

  const isAutoplay = mode === 'autoplay'
  // Reveal order: Polish(0) → English(1) → sentence PL(2) → sentence EN(3)
  const showEnglish = revealStep >= 1 || isAutoplay
  const showSentencePl = revealStep >= 2 || isAutoplay
  const showSentenceEn = revealStep >= 3 || isAutoplay

  return (
    <div
      className={`flashcard ${isInitial ? 'animate-card' : ''}`}
      onClick={onClick}
      onAnimationStart={() => console.log('[anim] card animation START')}
      onAnimationEnd={() => console.log('[anim] card animation END')}
    >
      <div className="flashcard__polish">
        {word.polish}
      </div>

      {showEnglish && (
        <>
          <div
            key={`divider-${word.id}`}
            className="flashcard__divider animate-reveal-fade"
            onAnimationStart={() => console.log('[anim] divider animation START')}
            onAnimationEnd={() => console.log('[anim] divider animation END')}
          />
          <div
            key={`english-${word.id}`}
            className="flashcard__english animate-reveal-fade"
            onAnimationStart={() => console.log('[anim] english animation START')}
            onAnimationEnd={() => console.log('[anim] english animation END')}
          >
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
        <div
          key={`sentence-pl-${word.id}`}
          className="flashcard__sentence-pl animate-reveal-fade"
          onAnimationStart={() => console.log('[anim] sentence-pl animation START')}
          onAnimationEnd={() => console.log('[anim] sentence-pl animation END')}
        >
          {word.sentencePl}
        </div>
      )}

      {word.sentenceEn && showSentenceEn && (
        <div
          key={`sentence-en-${word.id}`}
          className="flashcard__sentence-en animate-reveal-fade"
          onAnimationStart={() => console.log('[anim] sentence-en animation START')}
          onAnimationEnd={() => console.log('[anim] sentence-en animation END')}
        >
          {word.sentenceEn}
        </div>
      )}
    </div>
  )
}
