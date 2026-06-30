import { useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { FlashcardHeader } from '../components/flashcard/FlashcardHeader'
import { ModeToggle } from '../components/flashcard/ModeToggle'
import { FlashCard } from '../components/flashcard/FlashCard'
import { AudioButton } from '../components/flashcard/AudioButton'
import { ProgressBar } from '../components/flashcard/ProgressBar'
import { usePackageData } from '../hooks/usePackageData'
import { useFlashcard } from '../hooks/useFlashcard'
import { useAudio } from '../hooks/useAudio'
import { useAppStore } from '../store/useAppStore'
import { saveSession, savePackageProgress, getPackageProgress } from '../services/db'
import { StudyMode } from '../types/progress'
import './FlashcardPage.css'

export function FlashcardPage() {
  const { packageId, mode } = useParams<{ packageId: string; mode: string }>()
  const navigate = useNavigate()
  const studyMode = (mode === 'autoplay' ? 'autoplay' : 'fiszki') as StudyMode

  const { setPackage } = useAppStore()
  const { pack, loading, error } = usePackageData(packageId ?? null)
  const words = pack?.words ?? []

  const {
    currentWord,
    currentCardIndex,
    revealStep,
    isLastCard,
    isFullyRevealed,
    advance,
    reveal,
    reset,
    total,
  } = useFlashcard(words)

  const { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext } = useAudio(packageId ?? null)
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<string>(new Date().toISOString().split('T')[0])
  const completedWordsRef = useRef(0)

  useEffect(() => {
    if (packageId && studyMode) {
      setPackage(packageId, studyMode)
    }
    return () => {
      stop()
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
    }
  }, [packageId, studyMode])

  useEffect(() => {
    if (!pack || !packageId) return
    getPackageProgress(packageId).then(existing => {
      if (!existing) {
        savePackageProgress({
          packageId,
          startedAt: new Date().toISOString(),
          completedAt: null,
          currentIndex: 0,
        })
      }
    })
  }, [pack, packageId])

  const saveProgress = useCallback(async (index: number, completed: boolean) => {
    if (!packageId) return
    completedWordsRef.current = index
    await savePackageProgress({
      packageId,
      startedAt: new Date().toISOString(),
      completedAt: completed ? new Date().toISOString() : null,
      currentIndex: index,
    })
    if (completed) {
      await saveSession({
        packageId,
        date: sessionStartRef.current,
        wordsCompleted: total,
        mode: studyMode,
      })
    }
  }, [packageId, total, studyMode])

  const handleNext = useCallback(() => {
    if (isLastCard) {
      saveProgress(total, true)
      navigate('/')
    } else {
      advance()
      preloadNext(words, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, words, currentCardIndex, saveProgress, total, navigate])

  // Auto-play sequence
  useEffect(() => {
    if (studyMode !== 'autoplay' || !currentWord || words.length === 0) return

    const runSequence = async () => {
      try {
        // 1. Polish word audio
        await playWordPl(currentWord)
        await new Promise(r => setTimeout(r, 600))
        // 2. English word audio
        await playWord(currentWord)
        await new Promise(r => setTimeout(r, 600))
        // 3. Polish sentence audio
        if (currentWord.sentencePl) {
          await playSentencePl(currentWord)
          await new Promise(r => setTimeout(r, 600))
        }
        // 4. English sentence audio
        if (currentWord.sentenceEn) {
          await playSentence(currentWord)
          await new Promise(r => setTimeout(r, 600))
        }
        autoPlayTimerRef.current = setTimeout(handleNext, 500)
      } catch {
        autoPlayTimerRef.current = setTimeout(handleNext, 2000)
      }
    }

    autoPlayTimerRef.current = setTimeout(runSequence, 600)
    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
    }
  }, [currentCardIndex, studyMode, currentWord])

  if (loading) {
    return (
      <AppShell hideBottomNav>
        <div className="flashcard-page__loading">
          <div className="spinner" />
          <p>Ładowanie paczki...</p>
        </div>
      </AppShell>
    )
  }

  if (error || !pack) {
    return (
      <AppShell hideBottomNav>
        <div className="flashcard-page__error">
          <p>Nie udało się załadować paczki</p>
          <button onClick={() => navigate('/')}>Wróć</button>
        </div>
      </AppShell>
    )
  }

  if (!currentWord) return null

  return (
    <AppShell hideBottomNav>
      <ProgressBar current={currentCardIndex} total={total} />
      <FlashcardHeader title={pack.name} current={currentCardIndex} total={total} />
      <ModeToggle mode={studyMode} />

      <FlashCard
        key={currentCardIndex}
        word={currentWord}
        revealStep={revealStep}
        mode={studyMode}
        onClick={reveal}
      />

      <AudioButton
        onPlay={() => playWord(currentWord)}
        caption={studyMode === 'autoplay' ? 'Uruchom przed jazdą — audio leci automatycznie' : 'Odtwórz wymowę'}
      />

      {studyMode === 'fiszki' && (
        <div className="flashcard-page__actions">
          {!isFullyRevealed && revealStep < 3 && (
            <button className="flashcard-page__reveal-btn" onClick={reveal}>
              {revealStep === 0 ? 'Pokaż angielski' : revealStep === 1 ? 'Pokaż zdanie PL' : 'Pokaż zdanie EN'}
            </button>
          )}
          {(isFullyRevealed || revealStep >= 2) && (
            <button className="flashcard-page__next-btn" onClick={handleNext}>
              {isLastCard ? '🏁 Zakończ' : 'Następna →'}
            </button>
          )}
        </div>
      )}

      {studyMode === 'autoplay' && (
        <div className="flashcard-page__autoplay-info">
          <div className="flashcard-page__autoplay-dots">
            {[0,1,2].map(i => (
              <div key={i} className={`flashcard-page__dot ${i === currentCardIndex % 3 ? 'active' : ''}`} />
            ))}
          </div>
          <span>Odtwarzanie automatyczne</span>
        </div>
      )}
    </AppShell>
  )
}
