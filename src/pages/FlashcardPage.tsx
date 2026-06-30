import { useEffect, useRef, useCallback, useState } from 'react'
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
import { saveSession, savePackageProgress, getPackageProgress, saveWordProgress } from '../services/db'
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
  const startedAtRef = useRef<string | null>(null)
  const [playStep, setPlayStep] = useState<0 | 1 | 2 | 3 | null>(null)
  const handleNextRef = useRef<(status?: 'known' | 'learning') => void>(() => {})

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
      const now = new Date().toISOString()
      startedAtRef.current = existing?.startedAt ?? now
      if (!existing) {
        savePackageProgress({ packageId, startedAt: now, completedAt: null, currentIndex: 0 })
      }
    })
  }, [pack, packageId])

  const saveProgress = useCallback(async (index: number, completed: boolean) => {
    if (!packageId) return
    completedWordsRef.current = index
    await savePackageProgress({
      packageId,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
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

  const handleNext = useCallback((status?: 'known' | 'learning') => {
    if (currentWord && status) {
      saveWordProgress({
        wordId: currentWord.id,
        packageId: packageId ?? '',
        seenCount: 1,
        lastSeen: new Date().toISOString(),
        status,
      })
    }
    if (isLastCard) {
      saveProgress(total, true)
      navigate(packageId ? `/pakiet/${packageId}` : '/')
    } else {
      advance()
      preloadNext(words, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, words, currentCardIndex, saveProgress, total, navigate, currentWord, packageId])

  // Keep ref in sync so autoplay always calls the latest handleNext
  useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

  // Auto-play sequence
  useEffect(() => {
    if (studyMode !== 'autoplay' || !currentWord || words.length === 0) return

    const runSequence = async () => {
      try {
        setPlayStep(0)
        await playWordPl(currentWord)
        await new Promise(r => setTimeout(r, 600))
        setPlayStep(1)
        await playWord(currentWord)
        await new Promise(r => setTimeout(r, 400))
        await playWord(currentWord)
        await new Promise(r => setTimeout(r, 600))
        if (currentWord.sentencePl) {
          setPlayStep(2)
          await playSentencePl(currentWord)
          await new Promise(r => setTimeout(r, 600))
        }
        if (currentWord.sentenceEn) {
          setPlayStep(3)
          await playSentence(currentWord)
          await new Promise(r => setTimeout(r, 600))
        }
        setPlayStep(null)
        autoPlayTimerRef.current = setTimeout(() => handleNextRef.current(), 500)
      } catch {
        setPlayStep(null)
        autoPlayTimerRef.current = setTimeout(() => handleNextRef.current(), 2000)
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
      <FlashcardHeader title={pack.name} current={currentCardIndex} total={total} packageId={packageId} />
      <ModeToggle mode={studyMode} />

      <FlashCard
        key={currentCardIndex}
        word={currentWord}
        revealStep={revealStep}
        mode={studyMode}
        onClick={reveal}
      />

      <AudioButton
        onPlay={() => revealStep === 0 ? playWordPl(currentWord) : playWord(currentWord)}
        caption={studyMode === 'autoplay' ? 'Uruchom przed jazdą — audio leci automatycznie' : 'Odtwórz wymowę'}
      />

      {studyMode === 'fiszki' && (
        <div className="flashcard-page__actions">
          {revealStep < 3 && (
            <button className="flashcard-page__reveal-btn" onClick={reveal}>
              {revealStep === 0 ? 'Pokaż angielski' : revealStep === 1 ? 'Pokaż zdanie PL' : 'Pokaż zdanie EN'}
            </button>
          )}
          {revealStep >= 3 && (
            <div className="flashcard-page__rating">
              <button
                className="flashcard-page__rating-btn flashcard-page__rating-btn--known"
                onClick={() => handleNext('known')}
              >
                ✓ Znam
              </button>
              <button
                className="flashcard-page__rating-btn flashcard-page__rating-btn--learning"
                onClick={() => handleNext('learning')}
              >
                ✗ Jeszcze nie
              </button>
            </div>
          )}
        </div>
      )}

      {studyMode === 'autoplay' && (
        <div className="flashcard-page__autoplay-info">
          <div className="flashcard-page__playsteps">
            {(['PL', 'EN', 'PL zdanie', 'EN zdanie'] as const).map((label, i) => (
              <span
                key={i}
                className={`flashcard-page__playstep ${playStep === i ? 'active' : ''}`}
              >
                {label}
              </span>
            ))}
          </div>
          <span>Odtwarzanie automatyczne</span>
        </div>
      )}
    </AppShell>
  )
}
