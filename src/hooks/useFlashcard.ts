import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Word } from '../types/vocabulary'

export const REVEAL_STEPS = 4

export function useFlashcard(words: Word[]) {
  // Atomic selectors — see the note in App.tsx.
  const currentCardIndex = useAppStore(s => s.currentCardIndex)
  const revealStep = useAppStore(s => s.revealStep)
  const setCardIndex = useAppStore(s => s.setCardIndex)
  const advanceReveal = useAppStore(s => s.advanceReveal)
  const resetReveal = useAppStore(s => s.resetReveal)

  const currentWord = words[currentCardIndex] ?? null
  const isLastCard = currentCardIndex >= words.length - 1
  const isFullyRevealed = revealStep >= REVEAL_STEPS - 1

  const advance = useCallback(() => {
    if (!isLastCard) {
      setCardIndex(currentCardIndex + 1)
    }
  }, [currentCardIndex, isLastCard, setCardIndex])

  const goBack = useCallback(() => {
    if (currentCardIndex > 0) {
      setCardIndex(currentCardIndex - 1)
    }
  }, [currentCardIndex, setCardIndex])

  const reveal = useCallback(() => {
    if (!isFullyRevealed) {
      advanceReveal()
    }
  }, [isFullyRevealed, advanceReveal])

  const reset = useCallback(() => {
    setCardIndex(0)
    resetReveal()
  }, [setCardIndex, resetReveal])

  return {
    currentWord,
    currentCardIndex,
    revealStep,
    isLastCard,
    isFullyRevealed,
    advance,
    goBack,
    reveal,
    reset,
    total: words.length,
  }
}
