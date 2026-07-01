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
import './WordFlashPage.css'

const allPacks = packagesIndex as PackMeta[]

type CardSide = 'front' | 'back'

export function WordFlashPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { pack, loading } = usePackageData(packageId ?? null)
  const { enRate, plRate } = useAppStore()
  const { playWord, stop } = useAudio(packageId ?? null, enRate, plRate)

  const [studyWords, setStudyWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [cardIndex, setCardIndex] = useState(0)
  const [side, setSide] = useState<CardSide>('front')
  const [halfwayDone, setHalfwayDone] = useState(false)
  const [flipping, setFlipping] = useState(false)
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
      setHalfwayDone(false)
    })
  }, [pack, packageId])

  const currentWord = studyWords[cardIndex] ?? null
  const total = studyWords.length
  const isLast = cardIndex >= total - 1
  const packIdx = allPacks.findIndex(p => p.id === packageId)
  const nextPack = packIdx >= 0 && packIdx < allPacks.length - 1 ? allPacks[packIdx + 1] : null

  const flipCard = useCallback(() => {
    if (flipping || advancing || side === 'back') return
    setFlipping(true)
    setTimeout(() => {
      setSide('back')
      setHalfwayDone(true)
      if (currentWord) playWord(currentWord)
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
      setHalfwayDone(false)
      setKnownCount(wpList.filter(wp => wp.status === 'known').length)
      setShowMastery(false)
      setDone(false)
      setSessionKnown(0)
      sessionStartRef.current = false
    })
  }, [pack, packageId])

  if (loading || studyWords.length === 0) {
    return <div className="wf-loading"><div className="spinner" /></div>
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
      <div className="wf-done">
        <div className="wf-done__content">
          <div className="wf-done__icon">✓</div>
          <h1 className="wf-done__title">Sesja zakończona</h1>
          <p className="wf-done__sub">{pack?.name}</p>
          <p className="wf-done__count">Oznaczono jako znane: <strong>{sessionKnown}</strong></p>
          <div className="wf-done__actions">
            <button className="wf-done__btn wf-done__btn--repeat" onClick={handleRepeat}>↺ Powtórz</button>
            <button className="wf-done__btn wf-done__btn--exit" onClick={() => navigate('/')}>⌂ Menu</button>
          </div>
        </div>
      </div>
    )
  }

  const knownPct = pack ? (knownCount / pack.wordCount) * 100 : 0
  const progressPct = total > 0 ? (cardIndex / total) * 100 : 0
  const flipped = side === 'back'

  return (
    <div className="wf">
      <div className="wf__header">
        <button className="wf__back" onClick={() => { stop(); navigate(-1) }} aria-label="Wróć">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="wf__progress-bar">
          <div className="wf__progress-known" style={{ width: `${knownPct}%` }} />
          <div className="wf__progress-current" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="wf__counter">{cardIndex + 1} / {total}</span>
      </div>

      <div className="wf__scene">
        <div
          key={cardIndex}
          className={`wf__card${flipping && !halfwayDone ? ' wf__card--fold' : ''}${flipping && halfwayDone ? ' wf__card--unfold' : ''}${advancing ? ' wf__card--advance' : ''}`}
          onClick={flipCard}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && flipCard()}
        >
          {side === 'front' ? (
            <div className="wf__face wf__face--front">
              <span className="wf__lang-badge wf__lang-badge--pl">PL</span>
              <div className="wf__content">
                <p className="wf__word wf__word--pl">{currentWord?.polish}</p>
              </div>
              <p className="wf__tap-hint">dotknij, aby odsłonić</p>
            </div>
          ) : (
            <div className="wf__face wf__face--back">
              <span className="wf__lang-badge wf__lang-badge--en">EN</span>
              <div className="wf__content">
                <div className="wf__word-row">
                  <p className="wf__word wf__word--en">{currentWord?.english}</p>
                  <button
                    className="wf__play wf__play--accent"
                    onClick={e => { e.stopPropagation(); stop(); if (currentWord) playWord(currentWord) }}
                    aria-label="Wymowa EN"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  </button>
                </div>
                {currentWord?.sentenceEn && (
                  <p className="wf__sentence">{currentWord.sentenceEn}</p>
                )}
              </div>
              <p className="wf__tap-hint">dotknij, aby zobaczyć przód</p>
            </div>
          )}
        </div>
      </div>

      <div className={`wf__actions${flipped && !advancing ? ' wf__actions--visible' : ''}`}>
        <button className="wf__btn wf__btn--unknown" onClick={() => advance(false)} disabled={advancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Nie znam
        </button>
        <button className="wf__btn wf__btn--known" onClick={() => advance(true)} disabled={advancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Znam
        </button>
      </div>
    </div>
  )
}
