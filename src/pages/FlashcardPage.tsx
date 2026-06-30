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
import { saveSession, savePackageProgress, getPackageProgress, saveWordProgress, getPackageWordProgress } from '../services/db'
import { StudyMode } from '../types/progress'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './FlashcardPage.css'

const allPacks = packagesIndex as PackMeta[]

function getNextPack(currentId: string): PackMeta | null {
  const idx = allPacks.findIndex(p => p.id === currentId)
  return idx >= 0 && idx < allPacks.length - 1 ? allPacks[idx + 1] : null
}

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
    advance,
    reveal,
    reset,
    total,
  } = useFlashcard(words)

  const { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext } = useAudio(packageId ?? null)
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<string>(new Date().toISOString().split('T')[0])
  const startedAtRef = useRef<string | null>(null)
  const masteredAtRef = useRef<string | null>(null)
  const [playStep, setPlayStep] = useState<0 | 1 | 2 | 3 | null>(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const handleNextRef = useRef<(status?: 'known' | 'learning') => void>(() => {})

  const nextPack = packageId ? getNextPack(packageId) : null

  const clearAutoplay = () => {
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
  }

  useEffect(() => {
    if (packageId && studyMode) setPackage(packageId, studyMode)
    return () => {
      stop()
      clearAutoplay()
    }
  }, [packageId, studyMode])

  useEffect(() => {
    if (!pack || !packageId) return
    getPackageProgress(packageId).then(existing => {
      const now = new Date().toISOString()
      startedAtRef.current = existing?.startedAt ?? now
      masteredAtRef.current = existing?.masteredAt ?? null
      if (!existing) {
        savePackageProgress({ packageId, startedAt: now, completedAt: null, masteredAt: null, currentIndex: 0 })
      }
    })
  }, [pack, packageId])

  const saveProgress = useCallback(async (index: number, completed: boolean, newMasteredAt?: string | null) => {
    if (!packageId) return
    const masteredAt = newMasteredAt !== undefined ? newMasteredAt : masteredAtRef.current
    await savePackageProgress({
      packageId,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      completedAt: completed ? new Date().toISOString() : null,
      masteredAt,
      currentIndex: index,
    })
    if (completed) {
      await saveSession({ packageId, date: sessionStartRef.current, wordsCompleted: total, mode: studyMode })
    }
  }, [packageId, total, studyMode])

  // Fiszki: rate card → auto-detect mastery on last card
  const handleNext = useCallback(async (status?: 'known' | 'learning') => {
    if (currentWord && status) {
      await saveWordProgress({
        wordId: currentWord.id,
        packageId: packageId ?? '',
        seenCount: 1,
        lastSeen: new Date().toISOString(),
        status,
      })
    }
    if (isLastCard) {
      let newMasteredAt: string | null | undefined = undefined
      if (packageId) {
        const allWp = await getPackageWordProgress(packageId)
        const allKnown = words.length > 0 && allWp.filter(w => w.status === 'known').length >= words.length
        if (allKnown && !masteredAtRef.current) {
          newMasteredAt = new Date().toISOString()
          masteredAtRef.current = newMasteredAt
        }
      }
      await saveProgress(total, true, newMasteredAt)
      navigate(packageId ? `/pakiet/${packageId}` : '/')
    } else {
      advance()
      preloadNext(words, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, words, currentCardIndex, saveProgress, total, navigate, currentWord, packageId])

  useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

  // Skip current card in autoplay
  const handleSkip = useCallback(() => {
    clearAutoplay()
    stop()
    setPlayStep(null)
    if (isLastCard) {
      saveProgress(total, true).then(() => setShowCompletion(true))
    } else {
      advance()
      preloadNext(words, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, words, currentCardIndex, saveProgress, total, stop])

  // Autoplay end → show completion screen
  const handleAutoplayEnd = useCallback(async () => {
    await saveProgress(total, true)
    setShowCompletion(true)
  }, [saveProgress, total])

  const handleAutoplayEndRef = useRef(handleAutoplayEnd)
  useEffect(() => { handleAutoplayEndRef.current = handleAutoplayEnd }, [handleAutoplayEnd])

  // Completion actions
  const handleMastered = useCallback(async () => {
    if (!packageId) return
    const now = new Date().toISOString()
    masteredAtRef.current = now
    await Promise.all(words.map(w =>
      saveWordProgress({ wordId: w.id, packageId, seenCount: 1, lastSeen: now, status: 'known' })
    ))
    await savePackageProgress({
      packageId,
      startedAt: startedAtRef.current ?? now,
      completedAt: now,
      masteredAt: now,
      currentIndex: total,
    })
    navigate(packageId ? `/pakiet/${packageId}` : '/')
  }, [packageId, words, total, navigate])

  const handleRepeat = useCallback(() => {
    clearAutoplay()
    stop()
    setShowCompletion(false)
    setPlayStep(null)
    reset()
    // Reset session start for a fresh session log
    sessionStartRef.current = new Date().toISOString().split('T')[0]
  }, [reset, stop])

  const handleNextPack = useCallback(() => {
    if (nextPack) navigate(`/pakiet/${nextPack.id}/${studyMode}`)
  }, [nextPack, studyMode, navigate])

  // Auto-play sequence
  useEffect(() => {
    if (studyMode !== 'autoplay' || !currentWord || words.length === 0 || showCompletion) return

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
        const onDone = isLastCard ? () => handleAutoplayEndRef.current() : () => handleNextRef.current()
        autoPlayTimerRef.current = setTimeout(onDone, 500)
      } catch {
        setPlayStep(null)
        const onDone = isLastCard ? () => handleAutoplayEndRef.current() : () => handleNextRef.current()
        autoPlayTimerRef.current = setTimeout(onDone, 2000)
      }
    }

    autoPlayTimerRef.current = setTimeout(runSequence, 600)
    return clearAutoplay
  }, [currentCardIndex, studyMode, currentWord, isLastCard, showCompletion])

  // ─── Loading / error ───────────────────────────────────────────────────────

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

  // ─── Completion screen ─────────────────────────────────────────────────────

  if (showCompletion) {
    return (
      <AppShell hideBottomNav>
        <div className="completion">
          <div className="completion__top">
            <div className="completion__emoji">🎉</div>
            <h2 className="completion__title">Paczka gotowa!</h2>
            <p className="completion__meta">{pack.name} · {total} słów</p>
          </div>

          <div className="completion__actions">
            {/* Primary — mastered */}
            <button className="completion__btn completion__btn--mastered" onClick={handleMastered}>
              <span className="completion__btn-icon">★</span>
              <span className="completion__btn-body">
                <span className="completion__btn-label">Opanowana</span>
                <span className="completion__btn-sub">Oznacza wszystkie słowa jako znam</span>
              </span>
            </button>

            {/* Secondary row */}
            <div className="completion__row">
              <button className="completion__btn completion__btn--repeat" onClick={handleRepeat}>
                <span className="completion__btn-icon">↺</span>
                <span className="completion__btn-body">
                  <span className="completion__btn-label">Powtórz</span>
                  <span className="completion__btn-sub">Od początku</span>
                </span>
              </button>

              {nextPack ? (
                <button className="completion__btn completion__btn--next" onClick={handleNextPack}>
                  <span className="completion__btn-body">
                    <span className="completion__btn-label">Następna</span>
                    <span className="completion__btn-sub completion__btn-sub--name">{nextPack.name}</span>
                  </span>
                  <span className="completion__btn-icon">▶</span>
                </button>
              ) : (
                <button className="completion__btn completion__btn--next" onClick={() => navigate('/')}>
                  <span className="completion__btn-body">
                    <span className="completion__btn-label">Lista paczek</span>
                    <span className="completion__btn-sub">Wróć do menu</span>
                  </span>
                  <span className="completion__btn-icon">⌂</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!currentWord) return null

  // ─── Study view ────────────────────────────────────────────────────────────

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
              <span key={i} className={`flashcard-page__playstep ${playStep === i ? 'active' : ''}`}>
                {label}
              </span>
            ))}
          </div>
          <button className="flashcard-page__skip" onClick={handleSkip} aria-label="Pomiń słowo">
            Pomiń
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
            </svg>
          </button>
        </div>
      )}
    </AppShell>
  )
}
