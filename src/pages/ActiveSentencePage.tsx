import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePackageData } from '../hooks/usePackageData'
import { useAudio } from '../hooks/useAudio'
import { useAppStore } from '../store/useAppStore'
import { AudioButton } from '../components/flashcard/AudioButton'
import { MasteryScreen } from '../components/flashcard/MasteryScreen'
import { Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { getPackageWordProgress, saveWordProgress, saveSession, savePackageProgress, getPackageProgress } from '../services/db'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './ActiveSentencePage.css'

const allPacks = packagesIndex as PackMeta[]

export function ActiveSentencePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { pack, loading } = usePackageData(packageId ?? null)
  const { enRate, plRate } = useAppStore()
  const { playWord, playSentence, stop } = useAudio(packageId ?? null, enRate, plRate)

  const [studyWords, setStudyWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [showMastery, setShowMastery] = useState(false)
  const [sessionKnown, setSessionKnown] = useState(0)
  const [done, setDone] = useState(false)

  const sessionStartRef = useRef(false)

  useEffect(() => {
    if (!pack || !packageId) return

    getPackageWordProgress(packageId).then(wpList => {
      const map = new Map(wpList.map(wp => [wp.wordId, wp]))
      setProgressMap(map)

      const unknown = pack.words.filter(w => map.get(w.id)?.status !== 'known')
      const words = unknown.length > 0 ? unknown : pack.words
      const known = wpList.filter(wp => wp.status === 'known').length
      setStudyWords(words)
      setKnownCount(known)
      setCardIndex(0)
      setFlipped(false)
    })
  }, [pack, packageId])

  const currentWord = studyWords[cardIndex] ?? null
  const total = studyWords.length
  const isLast = cardIndex >= total - 1

  const packMeta = allPacks.find(p => p.id === packageId)
  const packIdx = allPacks.findIndex(p => p.id === packageId)
  const nextPack = packIdx >= 0 && packIdx < allPacks.length - 1 ? allPacks[packIdx + 1] : null

  const handleFlip = useCallback(() => {
    if (animating || flipped) return
    setFlipped(true)
    if (currentWord) {
      playWord(currentWord)
    }
  }, [animating, flipped, currentWord, playWord])

  const advance = useCallback(async (markKnown: boolean) => {
    if (!currentWord || !packageId || animating) return
    setAnimating(true)
    stop()

    if (markKnown) {
      const now = new Date().toISOString()
      const existing = progressMap.get(currentWord.id)
      const updated: WordProgress = {
        wordId: currentWord.id,
        packageId,
        seenCount: (existing?.seenCount ?? 0) + 1,
        lastSeen: now,
        status: 'known',
      }
      await saveWordProgress(updated)
      setProgressMap(prev => new Map(prev).set(currentWord.id, updated))
      setKnownCount(c => c + 1)
      setSessionKnown(c => c + 1)
    }

    setTimeout(async () => {
      setFlipped(false)
      setAnimating(false)

      if (isLast) {
        if (!sessionStartRef.current) {
          sessionStartRef.current = true
          await saveSession({
            packageId,
            date: new Date().toISOString().split('T')[0],
            wordsCompleted: total,
            mode: 'fiszki',
          })
        }

        const allProgress = await getPackageWordProgress(packageId)
        const allKnown = pack!.words.every(w => allProgress.find(p => p.wordId === w.id)?.status === 'known')

        const now = new Date().toISOString()
        const existing = await getPackageProgress(packageId)
        await savePackageProgress({
          packageId,
          startedAt: existing?.startedAt ?? now,
          completedAt: now,
          masteredAt: allKnown ? now : (existing?.masteredAt ?? null),
          currentIndex: 0,
        })

        if (allKnown) {
          setShowMastery(true)
        } else {
          setDone(true)
        }
      } else {
        setCardIndex(i => i + 1)
      }
    }, 320)
  }, [currentWord, packageId, animating, isLast, progressMap, total, pack, stop])

  const handleRepeat = useCallback(() => {
    if (!pack || !packageId) return
    getPackageWordProgress(packageId).then(wpList => {
      const map = new Map(wpList.map(wp => [wp.wordId, wp]))
      setProgressMap(map)
      const unknown = pack.words.filter(w => map.get(w.id)?.status !== 'known')
      const words = unknown.length > 0 ? unknown : pack.words
      setStudyWords(words)
      setCardIndex(0)
      setFlipped(false)
      setKnownCount(wpList.filter(wp => wp.status === 'known').length)
      setShowMastery(false)
      setDone(false)
      setSessionKnown(0)
      sessionStartRef.current = false
    })
  }, [pack, packageId])

  if (loading || studyWords.length === 0) {
    return (
      <div className="asc-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (showMastery && pack) {
    return (
      <MasteryScreen
        packName={pack.name}
        wordCount={pack.wordCount}
        onRepeat={handleRepeat}
        onNext={nextPack ? () => navigate(`/pakiet/${nextPack.id}/fiszki-start`) : null}
        nextPackName={nextPack?.name}
        onExit={() => navigate('/')}
      />
    )
  }

  if (done) {
    return (
      <div className="asc-done">
        <div className="asc-done__content">
          <div className="asc-done__icon">✓</div>
          <h1 className="asc-done__title">Sesja zakończona</h1>
          <p className="asc-done__sub">{pack?.name}</p>
          <p className="asc-done__count">Oznaczono jako znane: <strong>{sessionKnown}</strong></p>
          <div className="asc-done__actions">
            <button className="asc-done__btn asc-done__btn--repeat" onClick={handleRepeat}>
              ↺ Powtórz
            </button>
            <button className="asc-done__btn asc-done__btn--exit" onClick={() => navigate('/')}>
              ⌂ Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  const knownPct = pack ? (knownCount / pack.wordCount) * 100 : 0
  const progressPct = total > 0 ? (cardIndex / total) * 100 : 0
  const hasSentence = !!currentWord?.sentencePl

  return (
    <div className="asc">
      {/* Header */}
      <div className="asc__header">
        <button className="asc__back" onClick={() => { stop(); navigate(-1) }} aria-label="Wróć">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="asc__progress-bar">
          <div className="asc__progress-known" style={{ width: `${knownPct}%` }} />
          <div className="asc__progress-current" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="asc__counter">{cardIndex + 1} / {total}</span>
      </div>

      {/* Card */}
      <div className="asc__scene">
        <div
          key={cardIndex}
          className={`asc__card-wrap ${flipped ? 'asc__card-wrap--flipped' : ''}`}
        >
          {/* Front */}
          <div className="asc__face asc__face--front" onClick={!flipped ? handleFlip : undefined}>
            <div className="asc__front-content">
              <p className="asc__word asc__word--pl">{currentWord?.polish}</p>
              {hasSentence && (
                <p className="asc__sentence-pl">{currentWord?.sentencePl}</p>
              )}
              <p className="asc__hint">
                {hasSentence ? 'powiedz po angielsku' : 'dotknij, aby odsłonić'}
              </p>
            </div>
            {!flipped && (
              <button className="asc__reveal-btn" onClick={handleFlip}>
                Odsłoń odpowiedź
              </button>
            )}
          </div>

          {/* Back */}
          <div className="asc__face asc__face--back">
            <div className="asc__back-content">
              <div className="asc__back-row">
                <p className="asc__word asc__word--en">{currentWord?.english}</p>
                {currentWord && (
                  <AudioButton
                    onPlay={() => playWord(currentWord)}
                    onStop={stop}
                    caption=""
                  />
                )}
              </div>
              {currentWord?.sentenceEn && (
                <div className="asc__back-row asc__back-row--sentence">
                  <p className="asc__sentence-en">{currentWord.sentenceEn}</p>
                  {currentWord && (
                    <AudioButton
                      onPlay={() => playSentence(currentWord)}
                      onStop={stop}
                      caption=""
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className={`asc__actions ${flipped && !animating ? 'asc__actions--visible' : ''}`}>
        <button
          className="asc__btn asc__btn--unknown"
          onClick={() => advance(false)}
          disabled={animating}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Nie znam
        </button>
        <button
          className="asc__btn asc__btn--known"
          onClick={() => advance(true)}
          disabled={animating}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Znam
        </button>
      </div>
    </div>
  )
}
