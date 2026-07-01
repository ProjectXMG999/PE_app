import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { FlashcardHeader } from '../components/flashcard/FlashcardHeader'
import { ModeToggle } from '../components/flashcard/ModeToggle'
import { FlashCard } from '../components/flashcard/FlashCard'
import { AudioButton } from '../components/flashcard/AudioButton'
import { ProgressBar } from '../components/flashcard/ProgressBar'
import { MasteryScreen } from '../components/flashcard/MasteryScreen'
import { AutoplayDoneScreen } from '../components/flashcard/AutoplayDoneScreen'
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

  const { setPackage, autoplayMode, setAutoplayMode } = useAppStore()
  const { pack, loading, error } = usePackageData(packageId ?? null)
  const allWords = pack?.words ?? []
  // In fiszki mode: only show words not yet marked 'known'. Autoplay always shows all.
  const [studyWords, setStudyWords] = useState<typeof allWords>([])
  const [dbLoaded, setDbLoaded] = useState(false)

  const {
    currentWord,
    currentCardIndex,
    revealStep,
    isLastCard,
    advance,
    reveal,
    reset,
    total,
  } = useFlashcard(studyWords)

  const { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext } = useAudio(packageId ?? null)
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<string>(new Date().toISOString().split('T')[0])
  const startedAtRef = useRef<string | null>(null)
  const masteredAtRef = useRef<string | null>(null)
  const completedAtRef = useRef<string | null>(null)
  const savedIndexRef = useRef<number>(0)
  const prevRevealStepRef = useRef<number>(0)
  const resumeFromStepRef = useRef<0 | 1 | 2 | 3 | null>(null)
  const [playStep, setPlayStep] = useState<0 | 1 | 2 | 3 | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<'timeout' | 'error' | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [restartKey, setRestartKey] = useState(0)
  const [showCompletion, setShowCompletion] = useState(false)
  const [allAlreadyKnown, setAllAlreadyKnown] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [autoContinue, setAutoContinue] = useState(true)
  const [countdown, setCountdown] = useState(6)
  const handleNextRef = useRef<(status?: 'known' | 'learning') => void>(() => {})

  const nextPack = packageId ? getNextPack(packageId) : null

  const clearAutoplay = () => {
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
  }

  const restartCurrentWord = useCallback(() => {
    clearAutoplay()
    stop()
    resumeFromStepRef.current = null
    setIsPaused(false)
    setPlayStep(null)
    setAudioLoading(false)
    setAudioError(null)
    setRestartKey(k => k + 1)
  }, [stop])

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      // Resume from the step we paused on — don't reset playStep so pill stays lit
      setIsPaused(false)
      setAudioLoading(false)
      setAudioError(null)
      setRestartKey(k => k + 1)
    } else {
      clearAutoplay()
      stop()
      // Remember which step was active so resume can skip back to it
      resumeFromStepRef.current = playStep
      setAudioLoading(false)
      setAudioError(null)
      setIsPaused(true)
    }
  }, [isPaused, playStep, stop])

  const handleModeChange = useCallback((m: 'fast' | 'standard' | 'speaking') => {
    stop()
    clearAutoplay()
    resumeFromStepRef.current = null
    setAutoplayMode(m)
    setPlayStep(null)
    setIsPaused(false)
    setRestartKey(k => k + 1)
  }, [stop, setAutoplayMode])

  useEffect(() => {
    if (packageId && studyMode) setPackage(packageId, studyMode)
    setShowCompletion(false)
    setAllAlreadyKnown(false)
    setPlayStep(null)
    setKnownCount(0)
    setDbLoaded(false)
    setStudyWords([])
    startedAtRef.current = null
    masteredAtRef.current = null
    completedAtRef.current = null
    savedIndexRef.current = 0
    sessionStartRef.current = new Date().toISOString().split('T')[0]
    return () => {
      stop()
      clearAutoplay()
    }
  }, [packageId, studyMode])

  useEffect(() => {
    if (!pack || !packageId || dbLoaded || pack.id !== packageId) return
    Promise.all([
      getPackageProgress(packageId),
      getPackageWordProgress(packageId),
    ]).then(([existing, wordProgress]) => {
      const now = new Date().toISOString()
      startedAtRef.current = existing?.startedAt ?? now
      masteredAtRef.current = existing?.masteredAt ?? null
      completedAtRef.current = existing?.completedAt ?? null
      savedIndexRef.current = existing?.currentIndex ?? 0
      const knownIds = new Set(wordProgress.filter(w => w.status === 'known').map(w => w.wordId))
      setKnownCount(knownIds.size)
      if (!existing) {
        savePackageProgress({ packageId, startedAt: now, completedAt: null, masteredAt: null, currentIndex: 0 })
      }
      if (studyMode === 'fiszki' && knownIds.size > 0) {
        const remaining = pack.words.filter(w => !knownIds.has(w.id))
        if (remaining.length > 0) {
          setStudyWords(remaining)
        } else {
          // All known — show all from scratch, reset counter so progress bar starts at 0
          setStudyWords(pack.words)
          setKnownCount(0)
        }
      } else {
        setStudyWords(pack.words)
      }
      setDbLoaded(true)
    }).catch(() => {
      // DB error — show words anyway so user isn't stuck on spinner
      setStudyWords(pack.words)
      setDbLoaded(true)
    })
  }, [pack, packageId, studyMode, dbLoaded])

  const refreshKnownCount = useCallback(async () => {
    if (!packageId) return
    const wp = await getPackageWordProgress(packageId)
    setKnownCount(wp.filter(w => w.status === 'known').length)
  }, [packageId])

  const saveProgress = useCallback(async (index: number, completed: boolean, newMasteredAt?: string | null) => {
    if (!packageId) return
    const masteredAt = newMasteredAt !== undefined ? newMasteredAt : masteredAtRef.current
    const completedAt = completed
      ? new Date().toISOString()
      : (completedAtRef.current ?? null)
    // Never let currentIndex regress — keep the highest value seen
    const currentIndex = completed
      ? allWords.length
      : Math.max(index, savedIndexRef.current)
    await savePackageProgress({
      packageId,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      completedAt,
      masteredAt,
      currentIndex,
    })
    if (completed) {
      completedAtRef.current = completedAt
      await saveSession({ packageId, date: sessionStartRef.current, wordsCompleted: total, mode: studyMode })
    }
  }, [packageId, total, studyMode, allWords.length])

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
      if (status === 'known') {
        setKnownCount(c => c + 1)
      } else if (status === 'learning' && masteredAtRef.current) {
        // Word demoted — pack is no longer fully mastered
        masteredAtRef.current = null
      }
    }
    if (isLastCard) {
      let newMasteredAt: string | null | undefined = undefined
      if (packageId) {
        const allWp = await getPackageWordProgress(packageId)
        const knownNow = allWp.filter(w => w.status === 'known').length
        if (allWords.length > 0 && knownNow >= allWords.length) {
          newMasteredAt = masteredAtRef.current ?? new Date().toISOString()
          masteredAtRef.current = newMasteredAt
        } else {
          // Explicitly clear masteredAt if not all known
          newMasteredAt = null
          masteredAtRef.current = null
        }
      }
      await saveProgress(total, true, newMasteredAt)
      setShowCompletion(true)
    } else {
      advance()
      preloadNext(studyWords, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, allWords, studyWords, currentCardIndex, saveProgress, total, currentWord, packageId])

  useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

  // Reset reveal guard when card changes
  useEffect(() => {
    prevRevealStepRef.current = 0
  }, [currentCardIndex])

  // Fiszki: auto-play audio after each reveal step
  useEffect(() => {
    if (studyMode !== 'fiszki' || !currentWord || revealStep === 0) return
    if (revealStep <= prevRevealStepRef.current) return
    prevRevealStepRef.current = revealStep

    if (revealStep === 1) playWord(currentWord)
    else if (revealStep === 2) playSentencePl(currentWord)
    else if (revealStep === 3) playSentence(currentWord)
  }, [revealStep, studyMode, currentWord, playWord, playSentencePl, playSentence])

  // Skip current card in autoplay
  const handleSkip = useCallback(() => {
    clearAutoplay()
    stop()
    setPlayStep(null)
    setIsPaused(false)
    if (isLastCard) {
      saveProgress(total, true).then(() => setShowCompletion(true))
    } else {
      advance()
      preloadNext(studyWords, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, studyWords, currentCardIndex, saveProgress, total, stop])

  // Autoplay end → always show completion screen; countdown handles auto-continue
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
    await Promise.all(allWords.map(w =>
      saveWordProgress({ wordId: w.id, packageId, seenCount: 1, lastSeen: now, status: 'known' })
    ))
    await savePackageProgress({
      packageId,
      startedAt: startedAtRef.current ?? now,
      completedAt: now,
      masteredAt: now,
      currentIndex: allWords.length,
    })
    navigate(packageId ? `/pakiet/${packageId}` : '/')
  }, [packageId, allWords, navigate])

  const handleRepeat = useCallback(() => {
    clearAutoplay()
    stop()
    setShowCompletion(false)
    setAllAlreadyKnown(false)
    setPlayStep(null)
    setKnownCount(0)
    // Repeat always shows all words from scratch, ignoring previous known status
    setStudyWords(allWords)
    reset()
    sessionStartRef.current = new Date().toISOString().split('T')[0]
  }, [reset, stop, allWords])

  const handleNextPack = useCallback(() => {
    if (nextPack) navigate(`/pakiet/${nextPack.id}/${studyMode}`)
  }, [nextPack, studyMode, navigate])

  // Countdown timer on completion screen — autoplay only
  useEffect(() => {
    if (!showCompletion || studyMode !== 'autoplay' || !autoContinue || !nextPack) {
      setCountdown(6)
      return
    }
    if (countdown <= 0) {
      handleNextPack()
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [showCompletion, autoContinue, nextPack, countdown, handleNextPack])

  // Auto-play sequence
  useEffect(() => {
    if (studyMode !== 'autoplay' || !currentWord || studyWords.length === 0 || showCompletion || isPaused) return

    const word = currentWord
    let cancelled = false
    let pauseTimer: ReturnType<typeof setTimeout> | null = null

    const pause = (ms: number) => new Promise<void>(r => {
      pauseTimer = setTimeout(r, ms)
    })

    const playWithStatus = async (fn: () => Promise<'ok' | 'timeout' | 'error'>) => {
      setAudioLoading(true)
      setAudioError(null)
      const result = await fn()
      setAudioLoading(false)
      if (result !== 'ok') {
        setAudioError(result)
        await pause(1500)
        setAudioError(null)
      }
    }

    const runSequence = async () => {
      if (cancelled) return

      // resumeFrom: skip steps before the paused step, replay from it
      const resumeFrom = resumeFromStepRef.current
      resumeFromStepRef.current = null

      const shouldSkip = (step: 0 | 1 | 2 | 3) => resumeFrom !== null && step < resumeFrom

      if (autoplayMode === 'fast') {
        if (!shouldSkip(0)) { setPlayStep(0); await playWithStatus(() => playWordPl(word)); if (cancelled) return }
        await pause(500); if (cancelled) return
        if (!shouldSkip(1)) { setPlayStep(1); await playWithStatus(() => playWord(word)); if (cancelled) return }
        await pause(900); if (cancelled) return
      }

      if (autoplayMode === 'standard') {
        if (!shouldSkip(0)) { setPlayStep(0); await playWithStatus(() => playWordPl(word)); if (cancelled) return }
        await pause(1500); if (cancelled) return
        if (!shouldSkip(1)) {
          setPlayStep(1); await playWithStatus(() => playWord(word)); if (cancelled) return
          await pause(1400); if (cancelled) return
          await playWithStatus(() => playWord(word)); if (cancelled) return
          await pause(1500); if (cancelled) return
        }
        if (word.sentencePl && !shouldSkip(2)) { setPlayStep(2); await playWithStatus(() => playSentencePl(word)); if (cancelled) return; await pause(2500); if (cancelled) return }
        if (word.sentenceEn && !shouldSkip(3)) { setPlayStep(3); await playWithStatus(() => playSentence(word)); if (cancelled) return; await pause(1000); if (cancelled) return }
      }

      if (autoplayMode === 'speaking') {
        if (!shouldSkip(0)) { setPlayStep(0); await playWithStatus(() => playWordPl(word)); if (cancelled) return }
        await pause(3000); if (cancelled) return
        if (!shouldSkip(1)) {
          setPlayStep(1); await playWithStatus(() => playWord(word)); if (cancelled) return
          await pause(1400); if (cancelled) return
          await playWithStatus(() => playWord(word)); if (cancelled) return
          await pause(3000); if (cancelled) return
        }
        if (word.sentencePl && !shouldSkip(2)) { setPlayStep(2); await playWithStatus(() => playSentencePl(word)); if (cancelled) return; await pause(5000); if (cancelled) return }
        if (word.sentenceEn && !shouldSkip(3)) { setPlayStep(3); await playWithStatus(() => playSentence(word)); if (cancelled) return; await pause(3000); if (cancelled) return }
      }

      if (cancelled) return
      setPlayStep(null)
      const onDone = isLastCard ? () => handleAutoplayEndRef.current() : () => handleNextRef.current()
      autoPlayTimerRef.current = setTimeout(onDone, 600)
    }

    autoPlayTimerRef.current = setTimeout(runSequence, 800)

    return () => {
      cancelled = true
      if (pauseTimer) clearTimeout(pauseTimer)
      clearAutoplay()
      stop()
      setAudioLoading(false)
      setAudioError(null)
      resumeFromStepRef.current = null
    }
  // studyWords.length triggers re-run when DB finishes loading (studyWords: [] → pack.words)
  // isPaused gates the sequence; autoplayMode change re-fires with new timing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCardIndex, restartKey, studyMode, isLastCard, showCompletion, studyWords.length, isPaused, autoplayMode])

  // ─── Loading / error ───────────────────────────────────────────────────────

  if (error) {
    return (
      <AppShell hideBottomNav>
        <div className="flashcard-page__error">
          <p>Nie udało się załadować paczki</p>
          <button onClick={() => navigate('/')}>Wróć</button>
        </div>
      </AppShell>
    )
  }

  if (loading || !dbLoaded) {
    return (
      <AppShell hideBottomNav>
        <div className="flashcard-page__loading">
          <div className="spinner" />
          <p>Ładowanie paczki...</p>
        </div>
      </AppShell>
    )
  }

  if (!pack) {
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

  if (showCompletion && studyMode === 'fiszki') {
    const sessionKnown = knownCount
    const sessionTotal = allWords.length
    const allMastered = sessionKnown >= sessionTotal

    if (allMastered || allAlreadyKnown) {
      return (
        <MasteryScreen
          packName={pack.name}
          wordCount={sessionTotal}
          onRepeat={handleRepeat}
          onNext={nextPack ? handleNextPack : null}
          nextPackName={nextPack?.name}
          onExit={() => navigate('/')}
        />
      )
    }

    return (
      <AppShell hideBottomNav>
        <div className="completion">
          <div className="completion__top">
            <div className="completion__emoji">✅</div>
            <h2 className="completion__title">Koniec fiszek!</h2>
            <p className="completion__meta">
              {sessionKnown} / {sessionTotal} słów oznaczonych jako znam
            </p>
          </div>

          <div className="completion__actions">
            <button className="completion__btn completion__btn--mastered" onClick={handleMastered}>
              <span className="completion__btn-icon">★</span>
              <span className="completion__btn-body">
                <span className="completion__btn-label">Oznacz wszystkie jako znam</span>
                <span className="completion__btn-sub">Zapisz całą paczkę jako opanowaną</span>
              </span>
            </button>

            <div className="completion__row">
              <button className="completion__btn completion__btn--repeat" onClick={handleRepeat}>
                <span className="completion__btn-icon">↺</span>
                <span className="completion__btn-body">
                  <span className="completion__btn-label">Powtórz</span>
                  <span className="completion__btn-sub">Wszystkie słowa od nowa</span>
                </span>
              </button>

              {nextPack ? (
                <button className="completion__btn completion__btn--next" onClick={handleNextPack}>
                  <span className="completion__btn-body">
                    <span className="completion__btn-label">Następna</span>
                    <span className="completion__btn-sub">{nextPack.name}</span>
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

            <button className="completion__exit" onClick={() => navigate('/')}>
              Zakończ i wróć do menu
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  if (showCompletion && studyMode === 'autoplay') {
    const TOTAL_SECS = 6
    return (
      <AutoplayDoneScreen
        packName={pack.name}
        wordCount={total}
        autoContinue={autoContinue}
        countdown={countdown}
        totalSecs={TOTAL_SECS}
        nextPackName={nextPack?.name}
        onToggleAutoContinue={() => { setAutoContinue(v => !v); setCountdown(TOTAL_SECS) }}
        onRepeat={handleRepeat}
        onNext={nextPack ? handleNextPack : null}
        onMastered={handleMastered}
        onExit={() => navigate('/')}
      />
    )
  }

  if (!currentWord) return null

  // ─── Study view ────────────────────────────────────────────────────────────

  return (
    <AppShell hideBottomNav>
      <ProgressBar current={currentCardIndex} total={total} knownCount={knownCount} />
      <div className="flashcard-page">
      <FlashcardHeader title={pack.name} current={currentCardIndex} total={total} packageId={packageId} />
      {studyMode === 'autoplay' && <ModeToggle mode={studyMode} />}

      <FlashCard
        key={currentCardIndex}
        word={currentWord}
        revealStep={revealStep}
        mode={studyMode}
        onClick={studyMode === 'autoplay' ? handleSkip : reveal}
      />

      {studyMode === 'fiszki' && (
        <>
          <AudioButton
            onPlay={() => {
                if (revealStep === 0) return playWordPl(currentWord)
                if (revealStep === 1) return playWord(currentWord)
                if (revealStep === 2) return currentWord.sentencePl ? playSentencePl(currentWord) : playWord(currentWord)
                return currentWord.sentenceEn ? playSentence(currentWord) : playWord(currentWord)
              }}
            onStop={stop}
            caption="Odtwórz wymowę"
          />
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
        </>
      )}

      {studyMode === 'autoplay' && (
        <div className="flashcard-page__autoplay-bar">
          <div className="flashcard-page__mode-pills">
            {(['fast', 'standard', 'speaking'] as const).map(m => (
              <button
                key={m}
                className={`flashcard-page__mode-pill ${autoplayMode === m ? 'active' : ''}`}
                onClick={() => handleModeChange(m)}
              >
                {m === 'fast' ? '⚡ Szybko' : m === 'standard' ? '★ Standard' : '🎙 Speaking'}
              </button>
            ))}
          </div>
          <div className="flashcard-page__playsteps">
            {(['PL', 'EN', 'PL zdanie', 'EN zdanie'] as const).map((label, i) => {
              const isActive = playStep === i
              const showSpinner = isActive && audioLoading
              const showError = isActive && !!audioError
              return (
                <span
                  key={i}
                  className={`flashcard-page__playstep ${isActive ? 'active' : ''} ${showError ? 'flashcard-page__playstep--error' : ''}`}
                >
                  {showSpinner ? <span className="flashcard-page__playstep-spinner" /> : null}
                  {showError ? '⚠' : label}
                </span>
              )
            })}
          </div>
          <div className="flashcard-page__autoplay-btns">
            <button className="flashcard-page__restart-btn" onClick={restartCurrentWord} aria-label="Powtórz słowo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
              </svg>
              Powtórz
            </button>
            <button className="flashcard-page__pause-btn" onClick={handlePauseResume} aria-label={isPaused ? 'Wznów' : 'Pauza'}>
              {isPaused ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              )}
              {isPaused ? 'Wznów' : 'Pauza'}
            </button>
            <button className="flashcard-page__skip-btn" onClick={handleSkip} aria-label="Pomiń słowo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
              </svg>
              Pomiń
            </button>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  )
}
