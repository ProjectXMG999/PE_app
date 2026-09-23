import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { usePackageData } from '../hooks/usePackageData'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useAppStore, currentRequestRetention } from '../store/useAppStore'
import { MasteryScreen } from '../components/flashcard/MasteryScreen'
import { SessionDoneScreen } from '../components/flashcard/SessionDoneScreen'
import { Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { getPackageWordProgress, saveWordProgress, saveSession, savePackageProgress, getPackageProgress } from '../services/db'
import { applyKnown, applyUnknown } from '../services/review'
import { useStudyClock } from '../hooks/useStudyClock'
import { dayKey } from '../utils/day'
import { packAt, packById } from '../data/packIndex'
import { StudyStage, StageTrack } from '../components/flashcard/StudyStage'
import { PackSessionOpener } from '../components/flashcard/SessionOpener'
import { SessionStage } from '../components/flashcard/SessionStage'
import { useSessionOpener } from '../hooks/useSessionOpener'
import { useStudyPad } from '../hooks/useStudyPad'
import { useAppNavigate, useBack } from '../navigation/navigation'
import './ReviewPage.css'

export function WordFlashPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useAppNavigate()
  const { goBack, backLabel } = useBack()
  const { pack, error } = usePackageData(packageId ?? null)
  // Atomic selectors — see the note in App.tsx. This page re-renders on every
  // card, so a whole-state subscription made each `set()` anywhere a re-render.
  const enRate = useAppStore(s => s.enRate)
  const plRate = useAppStore(s => s.plRate)
  const { playWord, stop } = useAudio(packageId ?? null, enRate, plRate)
  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [studyWords, setStudyWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [cardIndex, setCardIndex] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [showMastery, setShowMastery] = useState(false)
  const [sessionKnown, setSessionKnown] = useState(0)
  const [done, setDone] = useState(false)
  // The session's own readiness, which is not `usePackageData`'s `loading`:
  // the pack still has to be filtered down to the words this run will drill.
  const [wordsReady, setWordsReady] = useState(false)

  const sessionStartRef = useRef(false)
  // Raw signal for adaptive difficulty: how many cards got a verdict this
  // session and how many were "Znam". Refs, not state — read once at session end
  // inside the `advance` callback, never rendered.
  const ratedRef = useRef(0)
  const knownHitRef = useRef(0)

  useEffect(() => {
    if (!pack || !packageId) return
    getPackageWordProgress(packageId).then(async wpList => {
      const map = new Map(wpList.map(wp => [wp.wordId, wp]))
      setProgressMap(map)
      const unknown = pack.words.filter(w => map.get(w.id)?.status !== 'known')
      const words = unknown.length > 0 ? unknown : pack.words
      const known = wpList.filter(wp => wp.status === 'known').length
      setStudyWords(words)
      setKnownCount(known)
      setCardIndex(0)
      resetToFront()
      // Before the writes below, not after: seeding a PackageProgress row is
      // bookkeeping, and the curtain shouldn't hang on it.
      setWordsReady(true)
      const existing = await getPackageProgress(packageId)
      if (!existing) {
        const now = new Date().toISOString()
        await savePackageProgress({
          packageId, startedAt: now, completedAt: null, masteredAt: null, listenedAt: null, currentIndex: 0,
        })
      }
    }).catch(() => setWordsReady(true))
  }, [pack, packageId])

  // No loading screen of its own any more — the curtain is it, which is also
  // what makes the failure path load-bearing: nothing else would ever lift it.
  // Level from the index, resolved synchronously — the words arrive later than
  // the sound does.
  const packLevel = packById(packageId)?.level
  const { visible: openerVisible, settled, dismiss: dismissOpener } =
    useSessionOpener(!!error || wordsReady, { level: packLevel })

  // The pad takes over from the curtain's chord, in the same key — it fades in
  // as the curtain lifts and is gone before the done screen's own sound. See
  // hooks/useStudyPad.ts.
  useStudyPad(!openerVisible && !done && !showMastery && !error, packLevel)

  const currentWord = studyWords[cardIndex] ?? null
  const total = studyWords.length
  const isLast = cardIndex >= total - 1
  const nextPack = packAt(packageId, 1)

  const flipCard = useCallback(() => {
    const revealing = side === 'front'
    flip(() => {
      // Fires exactly when the visible face swaps at the fold midpoint
      if (revealing && currentWord) playWord(currentWord)
      if (!revealing) stop()
    })
  }, [side, flip, currentWord, playWord, stop])

  const advance = useCallback(async (markKnown: boolean) => {
    if (!currentWord || !packageId || isAdvancing) return
    stop()

    // Both answers are recorded now. "Nie znam" used to write nothing at all,
    // which meant the app never learned which words were slipping — and left
    // seenCount counting only successes. Note it can't demote a mastered word:
    // applyUnknown reschedules it instead, so the route count never drops.
    const existing = progressMap.get(currentWord.id)
    const wasKnown = existing?.status === 'known'
    const rrOpts = { requestRetention: currentRequestRetention() }
    const updated: WordProgress = markKnown
      ? applyKnown(existing, currentWord.id, packageId, new Date(), rrOpts)
      : applyUnknown(existing, currentWord.id, packageId, new Date(), rrOpts)

    await saveWordProgress(updated)
    setProgressMap(prev => new Map(prev).set(currentWord.id, updated))
    ratedRef.current += 1
    if (markKnown) knownHitRef.current += 1
    if (markKnown && !wasKnown) {
      setKnownCount(c => c + 1)
      setSessionKnown(c => c + 1)
    }

    animateOut(async () => {
      if (isLast) {
        if (!sessionStartRef.current) {
          sessionStartRef.current = true
          await saveSession({
            packageId,
            date: dayKey(),
            startedAt: new Date().toISOString(),
            wordsCompleted: total,
            mode: 'fiszki',
            trainMode: 'word-flash',
            durationSec: elapsedSec(),
            ratedCount: ratedRef.current,
            knownHitCount: knownHitRef.current,
          })
          useAppStore.getState().applyTrainingOutcome({
            ratedCount: ratedRef.current,
            knownHitCount: knownHitRef.current,
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
          // Trenuj is not Słuchaj: the listen axis passes through untouched.
          // This used to write the pack's full word count, which is how a pack
          // nobody had listened to ended up badged "✓ Odsłuchana" — see
          // services/listenAxis.ts. `completedAt` above is the honest record
          // of this run ("✓ Przerobiona").
          listenedAt: existing?.listenedAt ?? null,
          currentIndex: existing?.currentIndex ?? 0,
        })
        if (allKnown) setShowMastery(true)
        else setDone(true)
      } else {
        setCardIndex(i => i + 1)
      }
    })
  }, [currentWord, packageId, isAdvancing, isLast, progressMap, total, pack, stop, animateOut])

  const handleRepeat = useCallback(() => {
    if (!pack || !packageId) return
    getPackageWordProgress(packageId).then(wpList => {
      const map = new Map(wpList.map(wp => [wp.wordId, wp]))
      setProgressMap(map)
      const unknown = pack.words.filter(w => map.get(w.id)?.status !== 'known')
      const words = unknown.length > 0 ? unknown : pack.words
      setStudyWords(words)
      setCardIndex(0)
      resetToFront()
      setKnownCount(wpList.filter(wp => wp.status === 'known').length)
      setShowMastery(false)
      setDone(false)
      setSessionKnown(0)
      sessionStartRef.current = false
      ratedRef.current = 0
      knownHitRef.current = 0
    })
  }, [pack, packageId])

  // Every branch below renders under the same curtain, so this page has
  // exactly one return. An early return above <SessionStage> would tear the
  // curtain off un-animated on precisely the path that needs it to lift
  // gracefully — a pack that failed to load.
  function body() {
    if (error || !pack || studyWords.length === 0) {
      return (
        <div className="review__state">
          <span className="review__state-icon" aria-hidden="true">⚠</span>
          <h1 className="review__state-title">Nie udało się wczytać pakietu</h1>
          <p className="review__state-text">{error ?? 'Spróbuj ponownie za chwilę.'}</p>
          <div className="review__state-actions">
            <button className="review__state-btn review__state-btn--primary u-cta" onClick={() => goBack()}>
              {backLabel}
            </button>
          </div>
        </div>
      )
    }

    if (showMastery && pack) {
      return (
        <MasteryScreen
          packName={pack.name}
          onRepeat={handleRepeat}
          onNext={nextPack ? () => navigate(`/pakiet/${nextPack.id}/fiszki-start`, { step: 'sideways' }) : null}
          nextPackName={nextPack?.name}
          onExit={() => goBack()}
        />
      )
    }

    if (done) {
      return (
        <SessionDoneScreen
          packName={pack?.name ?? ''}
          sessionKnown={sessionKnown}
          packKnown={knownCount}
          packTotal={pack?.words.length ?? 0}
          onRepeat={handleRepeat}
          onNext={nextPack ? () => navigate(`/pakiet/${nextPack.id}/fiszki-start`, { step: 'sideways' }) : null}
          nextPackName={nextPack?.name}
          onExit={() => goBack()}
        />
      )
    }

    const knownPct = pack ? (knownCount / pack.words.length) * 100 : 0
    const progressPct = total > 0 ? (cardIndex / total) * 100 : 0
    const flipped = side === 'back'

    return (
      <StudyStage
        tone="train"
        kicker="Word Flash"
        packageId={packageId}
        counter={`${cardIndex + 1} / ${total}`}
        rail={<StageTrack current={progressPct} known={knownPct} />}
        onExit={() => { stop(); goBack() }}
        exitLabel={backLabel}
        cardKey={cardIndex}
        polish={currentWord?.polish ?? ''}
        english={currentWord?.english ?? ''}
        side={side}
        cardClass={cardClass}
        onFlip={flipCard}
        onAnimationEnd={handleAnimationEnd}
        onPlay={() => { stop(); if (currentWord) playWord(currentWord) }}
        answersVisible={flipped && !isAdvancing}
        answersDisabled={isAdvancing}
        onAnswer={advance}
        covered={openerVisible}
      />
    )
  }

  return (
    <SessionStage
      tone="train"
      settled={settled}
      openerVisible={openerVisible}
      opener={
        <PackSessionOpener
          key="opener"
          packId={packageId ?? ''}
          mode="Word Flash"
          cards={wordsReady ? total : null}
          ready={settled}
          onDone={dismissOpener}
        />
      }
    >
      {body}
    </SessionStage>
  )
}
