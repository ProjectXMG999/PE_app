import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePackageData } from '../hooks/usePackageData'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useAppStore, currentRequestRetention } from '../store/useAppStore'
import { MasteryScreen } from '../components/flashcard/MasteryScreen'
import { SessionDoneScreen } from '../components/flashcard/SessionDoneScreen'
import { StudyStage, StageTrack, StageSentence } from '../components/flashcard/StudyStage'
import { Word } from '../types/vocabulary'
import { WordProgress } from '../types/progress'
import { getPackageWordProgress, saveWordProgress, saveSession, savePackageProgress, getPackageProgress } from '../services/db'
import { applyKnown, applyUnknown } from '../services/review'
import { useStudyClock } from '../hooks/useStudyClock'
import { dayKey } from '../utils/day'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

const allPacks = packagesIndex as PackMeta[]

export function ActiveSentencePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { pack, loading } = usePackageData(packageId ?? null)
  const { enRate, plRate } = useAppStore()
  const { playWord, playSentence, playWordPl, playSentencePl, stop } = useAudio(packageId ?? null, enRate, plRate)
  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [studyWords, setStudyWords] = useState<Word[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map())
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [showMastery, setShowMastery] = useState(false)
  const [sessionKnown, setSessionKnown] = useState(0)
  const [done, setDone] = useState(false)

  const sessionStartRef = useRef(false)
  // Raw signal for adaptive difficulty — see the note in WordFlashPage.
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
      setRevealed(false)
      const existing = await getPackageProgress(packageId)
      if (!existing) {
        const now = new Date().toISOString()
        await savePackageProgress({ packageId, startedAt: now, completedAt: null, masteredAt: null, currentIndex: 0 })
      }
    })
  }, [pack, packageId])

  const currentWord = studyWords[cardIndex] ?? null
  const total = studyWords.length
  const isLast = cardIndex >= total - 1
  const packIdx = allPacks.findIndex(p => p.id === packageId)
  const nextPack = packIdx >= 0 && packIdx < allPacks.length - 1 ? allPacks[packIdx + 1] : null

  const flipCard = useCallback(() => {
    const revealing = side === 'front'
    flip(() => {
      // Fires exactly when the visible face swaps at the fold midpoint
      if (revealing) {
        setRevealed(true)
        if (currentWord) playWord(currentWord)
      }
    })
  }, [side, flip, currentWord, playWord])

  const advance = useCallback(async (markKnown: boolean) => {
    if (!currentWord || !packageId || isAdvancing) return
    stop()

    // Both answers are recorded — see the note in WordFlashPage. "Nie znam"
    // never demotes a mastered word; it reschedules it for review instead.
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
      setRevealed(false)

      if (isLast) {
        if (!sessionStartRef.current) {
          sessionStartRef.current = true
          await saveSession({
            packageId,
            date: dayKey(),
            startedAt: new Date().toISOString(),
            wordsCompleted: total,
            mode: 'fiszki',
            trainMode: 'active-sentence',
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
          // Session only drills the still-unknown subset (`total`), which can
          // be far smaller than the pack — writing that into currentIndex
          // would shrink the pack's actual listen/heard position. The full
          // word count is what "played through" should mean here. `pack`
          // comes from usePackageData (the pack-content blob), which never
          // carries a wordCount field — pack.words.length is always correct.
          currentIndex: pack!.words.length,
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
      setRevealed(false)
      setKnownCount(wpList.filter(wp => wp.status === 'known').length)
      setShowMastery(false)
      setDone(false)
      setSessionKnown(0)
      sessionStartRef.current = false
      ratedRef.current = 0
      knownHitRef.current = 0
    })
  }, [pack, packageId])

  if (loading || studyWords.length === 0) {
    return <div className="stage-loading"><div className="spinner" /></div>
  }

  if (showMastery && pack) {
    return (
      <MasteryScreen
        packName={pack.name}
        onRepeat={handleRepeat}
        onNext={nextPack ? () => navigate(`/pakiet/${nextPack.id}/fiszki-start`) : null}
        nextPackName={nextPack?.name}
        onExit={() => navigate('/')}
      />
    )
  }

  // The same finish screen Word-Flash shows. This page used to carry its own
  // (asc-done): a different icon, different copy, no "next pack" — for the
  // same event in the sibling mode.
  if (done) {
    return (
      <SessionDoneScreen
        packName={pack?.name ?? ''}
        sessionKnown={sessionKnown}
        packKnown={knownCount}
        packTotal={pack?.words.length ?? 0}
        onRepeat={handleRepeat}
        onNext={nextPack ? () => navigate(`/pakiet/${nextPack.id}/fiszki-start`) : null}
        nextPackName={nextPack?.name}
        onExit={() => navigate('/')}
      />
    )
  }

  const knownPct = pack ? (knownCount / pack.words.length) * 100 : 0
  const progressPct = total > 0 ? (cardIndex / total) * 100 : 0
  const hasSentencePl = !!currentWord?.sentencePl
  const hasSentenceEn = !!currentWord?.sentenceEn

  return (
    <StudyStage
      tone="train"
      kicker="Active Sentence"
      packageId={packageId}
      counter={`${cardIndex + 1} / ${total}`}
      rail={<StageTrack current={progressPct} known={knownPct} />}
      onExit={() => { stop(); navigate(-1) }}
      exitLabel="Wróć do pakietu"
      cardKey={cardIndex}
      polish={currentWord?.polish ?? ''}
      english={currentWord?.english ?? ''}
      side={side}
      cardClass={cardClass}
      onFlip={flipCard}
      onAnimationEnd={handleAnimationEnd}
      onPlay={() => { stop(); if (currentWord) playWord(currentWord) }}
      onPlayPolish={() => { stop(); if (currentWord) playWordPl(currentWord) }}
      frontExtra={hasSentencePl && currentWord ? (
        <StageSentence
          text={currentWord.sentencePl!}
          onPlay={() => { stop(); playSentencePl(currentWord) }}
          label="Wymowa zdania po polsku"
        />
      ) : undefined}
      backExtra={hasSentenceEn && currentWord ? (
        <StageSentence
          text={currentWord.sentenceEn!}
          onPlay={() => { stop(); playSentence(currentWord) }}
          label="Wymowa zdania po angielsku"
        />
      ) : undefined}
      frontHint={hasSentencePl
        ? 'Powiedz po angielsku całe zdanie. Potem odsłoń.'
        : 'Powiedz po angielsku. Potem odsłoń.'}
      answersVisible={revealed && !isAdvancing}
      answersDisabled={isAdvancing}
      onAnswer={advance}
    />
  )
}
