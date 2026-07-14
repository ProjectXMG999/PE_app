import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePackageData } from '../hooks/usePackageData'
import { useAudio } from '../hooks/useAudio'
import { useAppStore } from '../store/useAppStore'
import { MasteryScreen } from '../components/flashcard/MasteryScreen'
import { Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { getPackageWordProgress, saveWordProgress, saveSession, savePackageProgress, getPackageProgress } from '../services/db'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './ActiveSentencePage.css'

const allPacks = packagesIndex as PackMeta[]

type CardSide = 'front' | 'back'

export function ActiveSentencePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { pack, loading } = usePackageData(packageId ?? null)
  const { enRate, plRate } = useAppStore()
  const { playWord, playSentence, playWordPl, playSentencePl, stop } = useAudio(packageId ?? null, enRate, plRate)

  const [studyWords, setStudyWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [cardIndex, setCardIndex] = useState(0)
  const [side, setSide] = useState<CardSide>('front')
  const [halfwayDone, setHalfwayDone] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [advancing, setAdvancing] = useState(false)
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
      setSide('front')
      setRevealed(false)
      setHalfwayDone(false)
    })
  }, [pack, packageId])

  const currentWord = studyWords[cardIndex] ?? null
  const total = studyWords.length
  const isLast = cardIndex >= total - 1
  const packIdx = allPacks.findIndex(p => p.id === packageId)
  const nextPack = packIdx >= 0 && packIdx < allPacks.length - 1 ? allPacks[packIdx + 1] : null

  const flipCard = useCallback(() => {
    if (flipping || advancing) return
    const targetSide = side === 'front' ? 'back' : 'front'

    setFlipping(true)
    // Phase 1: rotate to 90deg (card folds away)
    setTimeout(() => {
      setSide(targetSide)
      setHalfwayDone(true)
      if (targetSide === 'back') {
        setRevealed(true)
        if (currentWord) playWord(currentWord)
      }
      // Phase 2: rotate from 90deg back to 0deg (card unfolds with new content)
      setTimeout(() => {
        setFlipping(false)
        setHalfwayDone(false)
      }, 220)
    }, 220)
  }, [flipping, advancing, side, currentWord, playWord])

  const advance = useCallback(async (markKnown: boolean) => {
    if (!currentWord || !packageId || advancing) return
    setAdvancing(true)
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
      setSide('front')
      setRevealed(false)
      setHalfwayDone(false)
      setAdvancing(false)

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
        if (allKnown) setShowMastery(true)
        else setDone(true)
      } else {
        setCardIndex(i => i + 1)
      }
    }, 320)
  }, [currentWord, packageId, advancing, isLast, progressMap, total, pack, stop])

  const handleRepeat = useCallback(() => {
    if (!pack || !packageId) return
    getPackageWordProgress(packageId).then(wpList => {
      const map = new Map(wpList.map(wp => [wp.wordId, wp]))
      setProgressMap(map)
      const unknown = pack.words.filter(w => map.get(w.id)?.status !== 'known')
      const words = unknown.length > 0 ? unknown : pack.words
      setStudyWords(words)
      setCardIndex(0)
      setSide('front')
      setRevealed(false)
      setHalfwayDone(false)
      setKnownCount(wpList.filter(wp => wp.status === 'known').length)
      setShowMastery(false)
      setDone(false)
      setSessionKnown(0)
      sessionStartRef.current = false
    })
  }, [pack, packageId])

  if (loading || studyWords.length === 0) {
    return <div className="asc-loading"><div className="spinner" /></div>
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
          <p className="asc-done__count">Opanowano: <strong>{sessionKnown}</strong></p>
          <div className="asc-done__actions">
            <button className="asc-done__btn asc-done__btn--repeat" onClick={handleRepeat}>↺ Powtórz</button>
            <button className="asc-done__btn asc-done__btn--exit" onClick={() => navigate('/')}>⌂ Menu</button>
          </div>
        </div>
      </div>
    )
  }

  const knownPct = pack ? (knownCount / pack.wordCount) * 100 : 0
  const progressPct = total > 0 ? (cardIndex / total) * 100 : 0
  const hasSentencePl = !!currentWord?.sentencePl
  const hasSentenceEn = !!currentWord?.sentenceEn

  return (
    <div className="asc">
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

      <div className="asc__scene">
        <div
          key={cardIndex}
          className={`asc__card${flipping && !halfwayDone ? ' asc__card--fold' : ''}${flipping && halfwayDone ? ' asc__card--unfold' : ''}${advancing ? ' asc__card--advance' : ''}`}
          onClick={flipCard}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && flipCard()}
        >
          {side === 'front' ? (
            <div className="asc__face asc__face--front">
              <span className="asc__lang-badge asc__lang-badge--pl">PL</span>

              <div className="asc__content">
                <div className="asc__word-line">
                  <p className="asc__word asc__word--pl">{currentWord?.polish}</p>
                  {currentWord && (
                    <button
                      className="asc__play"
                      onClick={e => { e.stopPropagation(); stop(); playWordPl(currentWord) }}
                      aria-label="Wymowa PL słowo"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    </button>
                  )}
                </div>

                {hasSentencePl && (
                  <div className="asc__sentence-line">
                    <p className="asc__sentence asc__sentence--pl">{currentWord?.sentencePl}</p>
                    {currentWord && (
                      <button
                        className="asc__play asc__play--sm"
                        onClick={e => { e.stopPropagation(); stop(); playSentencePl(currentWord) }}
                        aria-label="Wymowa PL zdanie"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5,3 19,12 5,21"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className="asc__tap-hint">
                {hasSentencePl ? 'powiedz po angielsku · obróć kartę' : 'dotknij, aby odsłonić'}
              </p>
            </div>
          ) : (
            <div className="asc__face asc__face--back">
              <span className="asc__lang-badge asc__lang-badge--en">EN</span>

              <div className="asc__content">
                <div className="asc__word-line">
                  <p className="asc__word asc__word--en">{currentWord?.english}</p>
                  <button
                    className="asc__play asc__play--accent"
                    onClick={e => { e.stopPropagation(); stop(); if (currentWord) playWord(currentWord) }}
                    aria-label="Wymowa EN słowo"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  </button>
                </div>

                {hasSentenceEn && currentWord && (
                  <div className="asc__sentence-line asc__sentence-line--divider">
                    <p className="asc__sentence asc__sentence--en">{currentWord.sentenceEn}</p>
                    <button
                      className="asc__play asc__play--sm asc__play--accent"
                      onClick={e => { e.stopPropagation(); stop(); playSentence(currentWord) }}
                      aria-label="Wymowa EN zdanie"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <p className="asc__tap-hint">dotknij, aby zobaczyć przód</p>
            </div>
          )}
        </div>
      </div>

      <div className={`asc__actions${revealed && !advancing ? ' asc__actions--visible' : ''}`}>
        <button className="asc__btn asc__btn--unknown" onClick={() => advance(false)} disabled={advancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Nie znam
        </button>
        <button className="asc__btn asc__btn--known" onClick={() => advance(true)} disabled={advancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Znam
        </button>
      </div>
    </div>
  )
}
