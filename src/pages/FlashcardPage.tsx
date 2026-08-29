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
import { AutoplayControls } from '../components/flashcard/AutoplayControls'
import { AutoplaySettingsSheet } from '../components/flashcard/AutoplaySettingsSheet'
import { usePackageData } from '../hooks/usePackageData'
import { useFlashcard } from '../hooks/useFlashcard'
import { useAudio } from '../hooks/useAudio'
import { useAutoplaySequence } from '../hooks/useAutoplaySequence'
import { useWakeLock } from '../hooks/useWakeLock'
import { useMediaSession } from '../hooks/useMediaSession'
import { startKeepAlive, stopKeepAlive } from '../audio/keepAlive'
import { useAppStore } from '../store/useAppStore'
import { saveSession, savePackageProgress, getPackageProgress, saveWordProgress, getPackageWordProgress, getWordProgress } from '../services/db'
import { StudyMode } from '../types/progress'
import { applyKnown, applyUnknown } from '../services/review'
import { useStudyClock } from '../hooks/useStudyClock'
import { dayKey } from '../utils/day'
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

  const { setPackage, autoplayMode, setAutoplayMode, enRate, plRate, keepScreenAudioAlive } = useAppStore()
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
    goBack,
    reveal,
    reset,
    total,
  } = useFlashcard(studyWords)

  const { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext } = useAudio(packageId ?? null, enRate, plRate)
  // Autoplay is designed to run with the screen off — on a walk, in the car —
  // so this clock keeps counting while the tab is hidden, unlike the tap-driven
  // Trenuj pages where a hidden tab means the user has genuinely stopped.
  const { elapsedSec } = useStudyClock({ countWhileHidden: studyMode === 'autoplay' })
  const sessionStartRef = useRef<string>(dayKey())
  const startedAtRef = useRef<string | null>(null)
  const masteredAtRef = useRef<string | null>(null)
  const completedAtRef = useRef<string | null>(null)
  const savedIndexRef = useRef<number>(0)
  const prevRevealStepRef = useRef<number>(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [allAlreadyKnown, setAllAlreadyKnown] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [autoContinue, setAutoContinue] = useState(true)
  const [countdown, setCountdown] = useState(6)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Assigned once handleNext / handleAutoplayEnd exist below — the autoplay
  // sequence calls the latest version through these.
  const handleNextRef = useRef<(status?: 'known' | 'learning') => void>(() => {})
  const handleAutoplayEndRef = useRef<() => void>(() => {})

  const nextPack = packageId ? getNextPack(packageId) : null

  // Autoplay timeline — play/gap steps per mode. See hooks/useAutoplaySequence.ts
  // and config/autoplayModes.ts. Inert in fiszki mode (`enabled` false).
  const { playStep, audioLoading, audioError, speakCountdown, skipStep, restart } =
    useAutoplaySequence({
      word: currentWord,
      mode: autoplayMode,
      enabled: studyMode === 'autoplay' && studyWords.length > 0 && !showCompletion,
      isPaused,
      isLastCard,
      cardIndex: currentCardIndex,
      play: {
        word: () => playWord(currentWord!),
        sentence: () => playSentence(currentWord!),
        wordPl: () => playWordPl(currentWord!),
        sentencePl: () => playSentencePl(currentWord!),
      },
      stop,
      onCardDone: () => handleNextRef.current(),
      onLastDone: () => handleAutoplayEndRef.current(),
    })

  const restartCurrentWord = useCallback(() => {
    stop()
    setIsPaused(false)
    restart()
  }, [stop, restart])

  // Split into pause/resume so Media Session 'play' while playing is a no-op
  // (a toggle would flip to paused when the OS re-sends 'play')
  const handleResume = useCallback(() => {
    if (!isPaused) return
    setIsPaused(false) // sequence effect re-fires and resumes from the paused step
  }, [isPaused])

  const handlePause = useCallback(() => {
    if (isPaused) return
    stop() // hard stop — no clip follows; iOS needs the src reset to go silent
    setIsPaused(true) // sequence effect snapshots the current step, then bails
  }, [isPaused, stop])

  const handlePauseResume = useCallback(() => {
    if (isPaused) handleResume()
    else handlePause()
  }, [isPaused, handleResume, handlePause])

  const handleModeChange = useCallback((m: 'fast' | 'standard' | 'speaking') => {
    stop()
    setAutoplayMode(m)
    setIsPaused(false)
    restart()
  }, [stop, setAutoplayMode, restart])

  useEffect(() => {
    if (packageId && studyMode) setPackage(packageId, studyMode)
    setShowCompletion(false)
    setAllAlreadyKnown(false)
    setKnownCount(0)
    setDbLoaded(false)
    setStudyWords([])
    startedAtRef.current = null
    masteredAtRef.current = null
    completedAtRef.current = null
    savedIndexRef.current = 0
    sessionStartRef.current = dayKey()
    return () => {
      stop()
    }
  }, [packageId, studyMode])

  // Stop audio on every unmount — catches navigation via header links and back button
  useEffect(() => {
    return () => { stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      await saveSession({
        packageId,
        date: sessionStartRef.current,
        startedAt: new Date().toISOString(),
        wordsCompleted: total,
        mode: studyMode,
        autoplayMode: studyMode === 'autoplay' ? autoplayMode : undefined,
        durationSec: elapsedSec(),
      })
    }
  }, [packageId, total, studyMode, allWords.length, autoplayMode, elapsedSec])

  // Fiszki: rate card → auto-detect mastery on last card
  const handleNext = useCallback(async (status?: 'known' | 'learning') => {
    if (currentWord && status) {
      // Reads the existing row first: this used to write seenCount: 1 flat,
      // wiping however many times the word had actually been seen.
      const existing = await getWordProgress(currentWord.id)
      const wasKnown = existing?.status === 'known'
      const updated = status === 'known'
        ? applyKnown(existing, currentWord.id, packageId ?? '')
        : applyUnknown(existing, currentWord.id, packageId ?? '')
      await saveWordProgress(updated)

      if (status === 'known' && !wasKnown) {
        setKnownCount(c => c + 1)
      } else if (updated.status !== 'known' && masteredAtRef.current) {
        // A word that was never mastered can still un-master the pack. One the
        // user had already mastered cannot — it stays 'known' and is merely
        // rescheduled for review.
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

  // Skip current card in autoplay. advance()/goBack() changes currentCardIndex,
  // which tears the running sequence down via the hook's effect cleanup.
  const handleSkip = useCallback(() => {
    stop()
    setIsPaused(false)
    if (isLastCard) {
      saveProgress(total, true).then(() => setShowCompletion(true))
    } else {
      advance()
      preloadNext(studyWords, currentCardIndex + 1)
      saveProgress(currentCardIndex + 1, false)
    }
  }, [isLastCard, advance, preloadNext, studyWords, currentCardIndex, saveProgress, total, stop])

  // Previous card in autoplay (Media Session previoustrack); on the first card it
  // restarts the current word instead.
  const handlePrev = useCallback(() => {
    stop()
    setIsPaused(false)
    if (currentCardIndex > 0) goBack()
    else restart()
  }, [currentCardIndex, goBack, stop, restart])

  // Autoplay end → always show completion screen; countdown handles auto-continue
  const handleAutoplayEnd = useCallback(async () => {
    await saveProgress(total, true)
    setShowCompletion(true)
  }, [saveProgress, total])

  useEffect(() => { handleAutoplayEndRef.current = handleAutoplayEnd }, [handleAutoplayEnd])

  // Completion actions
  const handleMastered = useCallback(async () => {
    if (!packageId) return
    const now = new Date().toISOString()
    masteredAtRef.current = now
    // Read existing rows first so this doesn't reset seenCount, and so every
    // word enters the review schedule instead of being marked known forever
    // with no follow-up.
    const existingList = await getPackageWordProgress(packageId)
    const byId = new Map(existingList.map(w => [w.wordId, w]))
    await Promise.all(allWords.map(w =>
      saveWordProgress(applyKnown(byId.get(w.id), w.id, packageId))
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
    stop()
    setShowCompletion(false)
    setAllAlreadyKnown(false)
    setKnownCount(0)
    // Repeat always shows all words from scratch, ignoring previous known status
    setStudyWords(allWords)
    reset()
    restart()
    sessionStartRef.current = dayKey()
  }, [reset, stop, allWords, restart])

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

  // Keep screen awake while autoplay is actively running (paused → dim normally)
  useWakeLock(studyMode === 'autoplay' && !isPaused && !showCompletion && !loading)

  // Experimental (opt-in via Settings): silent loop keeps timers + media session
  // alive during gaps with the screen off — see audio/keepAlive.ts. Off by default
  // pending device testing (battery cost, iOS Now Playing owner conflicts).
  const keepAliveActive = keepScreenAudioAlive && studyMode === 'autoplay' && !isPaused && !showCompletion && !loading
  useEffect(() => {
    if (keepAliveActive) startKeepAlive()
    else stopKeepAlive()
    return () => stopKeepAlive()
  }, [keepAliveActive])

  // Lock-screen / notification transport controls + metadata.
  // Full support on Android Chrome; best-effort on iOS (stop() clears src between
  // cards, which tears down Now Playing — accepted, see useMediaSession docs).
  useMediaSession({
    enabled: studyMode === 'autoplay' && !showCompletion && !!currentWord,
    title: currentWord?.english ?? '',
    artist: currentWord?.polish ?? '',
    album: pack?.name ?? 'Project English',
    playing: !isPaused,
    onPlay: handleResume,
    onPause: handlePause,
    onNext: handleSkip,
    onPrev: handlePrev,
    onStop: handlePause,
  })

  // ─── Loading / error ───────────────────────────────────────────────────────

  if (error) {
    return (
      <AppShell hideBottomNav hideSidebar={false}>
        <div className="flashcard-page__error">
          <p>Nie udało się załadować paczki</p>
          <button onClick={() => navigate('/')}>Wróć</button>
        </div>
      </AppShell>
    )
  }

  if (loading || !dbLoaded) {
    return (
      <AppShell hideBottomNav hideSidebar={false}>
        <div className="flashcard-page__loading">
          <div className="spinner" />
          <p>Ładowanie paczki...</p>
        </div>
      </AppShell>
    )
  }

  if (!pack) {
    return (
      <AppShell hideBottomNav hideSidebar={false}>
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
          onRepeat={handleRepeat}
          onNext={nextPack ? handleNextPack : null}
          nextPackName={nextPack?.name}
          onExit={() => navigate('/')}
        />
      )
    }

    return (
      <AppShell hideBottomNav hideSidebar={false}>
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
                <span className="completion__btn-icon completion__btn-icon--svg" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-4"/>
                  </svg>
                </span>
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
    <AppShell hideBottomNav hideSidebar={false}>
      <ProgressBar current={currentCardIndex} total={total} knownCount={knownCount} />
      <div className="flashcard-page">
      <FlashcardHeader title={pack.name} current={currentCardIndex} total={total} packageId={packageId} />
      <FlashCard
        key={currentCardIndex}
        word={currentWord}
        revealStep={revealStep}
        mode={studyMode}
        onClick={studyMode === 'autoplay' ? skipStep : reveal}
        activeLine={studyMode === 'autoplay' ? playStep : null}
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
            <button className="flashcard-page__skip-fiszki" onClick={handleSkip}>
              Pomiń
            </button>
          </div>
        </>
      )}

      {studyMode === 'autoplay' && (
        <AutoplayControls
          autoplayMode={autoplayMode}
          onModeChange={handleModeChange}
          playStep={playStep}
          audioLoading={audioLoading}
          audioError={audioError}
          isPaused={isPaused}
          onPauseResume={handlePauseResume}
          onRestart={restartCurrentWord}
          onSkip={handleSkip}
          onOpenSettings={() => setSheetOpen(true)}
          countdown={speakCountdown}
        />
      )}
      </div>
      {sheetOpen && <AutoplaySettingsSheet onClose={() => setSheetOpen(false)} />}
    </AppShell>
  )
}
