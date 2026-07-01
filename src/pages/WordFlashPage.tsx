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
import './WordFlashPage.css'

const allPacks = packagesIndex as PackMeta[]

export function WordFlashPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { pack, loading } = usePackageData(packageId ?? null)
  const { enRate, plRate } = useAppStore()
  const { playWord, stop } = useAudio(packageId ?? null, enRate, plRate)

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
        // Save session
        if (!sessionStartRef.current) {
          sessionStartRef.current = true
          await saveSession({
            packageId,
            date: new Date().toISOString().split('T')[0],
            wordsCompleted: total,
            mode: 'fiszki',
          })
        }

        // Check mastery
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
  }, [currentWord, packageId, animating, isLast, progressMap, total, pack])

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
      <div className="wf-loading">
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
      <div className="wf-done">
        <div className="wf-done__content">
          <div className="wf-done__icon">✓</div>
          <h1 className="wf-done__title">Sesja zakończona</h1>
          <p className="wf-done__sub">{pack?.name}</p>
          <p className="wf-done__count">Oznaczono jako znane: <strong>{sessionKnown}</strong></p>
          <div className="wf-done__actions">
            <button className="wf-done__btn wf-done__btn--repeat" onClick={handleRepeat}>
              ↺ Powtórz
            </button>
            <button className="wf-done__btn wf-done__btn--exit" onClick={() => navigate('/')}>
              ⌂ Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  const knownPct = pack ? (knownCount / pack.wordCount) * 100 : 0
  const progressPct = total > 0 ? (cardIndex / total) * 100 : 0

  return (
    <div className="wf">
      {/* Header */}
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

      {/* Card area */}
      <div className="wf__scene">
        <div
          key={cardIndex}
          className={`wf__card-wrap ${flipped ? 'wf__card-wrap--flipped' : ''}`}
          onClick={!flipped ? handleFlip : undefined}
        >
          {/* Front */}
          <div className="wf__face wf__face--front">
            <p className="wf__word wf__word--pl">{currentWord?.polish}</p>
            <p className="wf__hint">dotknij, aby odsłonić</p>
          </div>

          {/* Back */}
          <div className="wf__face wf__face--back">
            <div className="wf__back-content">
              <p className="wf__word wf__word--en">{currentWord?.english}</p>
              {currentWord && (
                <div className="wf__audio-row">
                  <AudioButton
                    onPlay={() => playWord(currentWord)}
                    onStop={stop}
                    caption=""
                  />
                </div>
              )}
              {currentWord?.sentenceEn && (
                <p className="wf__sentence-en">{currentWord.sentenceEn}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons — only after flip */}
      <div className={`wf__actions ${flipped && !animating ? 'wf__actions--visible' : ''}`}>
        <button
          className="wf__btn wf__btn--unknown"
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
          className="wf__btn wf__btn--known"
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
