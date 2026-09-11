import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useStudyClock } from '../hooks/useStudyClock'
import { useSmartSession } from '../hooks/useSmartSession'
import { useAppStore, currentRequestRetention } from '../store/useAppStore'
import { applyKnown, applyUnknown } from '../services/review'
import { saveSession, saveWordProgress } from '../services/db'
import { recomputeMasteryFor } from '../services/masteryRepair'
import { shouldPromptLevelUp } from '../services/comfort'
import { loadProgressSnapshot, packLevelOf } from '../hooks/useProgressData'
import { dayKey } from '../utils/day'
import { SmartSegment } from '../services/smartQueue'
import { SmartInfoCard } from '../components/smart/SmartInfoCard'
import { SmartProgressRail } from '../components/smart/SmartProgressRail'
import { SmartDoneScreen, SmartSegmentTally } from '../components/smart/SmartDoneScreen'
import { LevelUpPrompt } from '../components/today/LevelUpPrompt'
import { StudyStage } from '../components/flashcard/StudyStage'
import { plPackets } from '../utils/packVisuals'
import './ReviewPage.css'

const EMPTY_TALLY = (): Record<SmartSegment, SmartSegmentTally> => ({
  learn: { rated: 0, known: 0 },
  review: { rated: 0, known: 0 },
  stretch: { rated: 0, known: 0 },
})

/**
 * Does this card measure *retention* — i.e. may it feed reviewHealth?
 *
 * Not the same as `segment === 'review'`. That stream also carries stragglers:
 * the last one or two words of a half-finished pack, swept in so the pack gets
 * closed out. Those were never mastered, so "Nie znam" on one says nothing
 * about memory — counting them would reintroduce, inside the review segment,
 * exactly the composition bias that keeping learn cards out is meant to avoid.
 * `status: 'known'` is permanent (see services/review.ts), so it's the honest
 * test for "this word was learned and is being re-checked".
 */
const measuresRetention = (segment: SmartSegment, progress?: { status: string }) =>
  segment === 'review' && progress?.status === 'known'

/**
 * The Inteligentny mode's session runner. Same card mechanics as WordFlash /
 * ReviewPage; what's new is the `info` step type (a hand-off card between
 * segments) and a per-segment tally that feeds the done screen and the
 * comfort-level update.
 */
export function SmartSessionPage() {
  const navigate = useNavigate()
  const { enRate, plRate } = useAppStore()
  const [nonce, setNonce] = useState(0)
  const { steps, packCount, loading, error } = useSmartSession(nonce)

  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [levelUpTarget, setLevelUpTarget] = useState<number | null>(null)
  const [comfortBefore] = useState(() => useAppStore.getState().comfortLevel)
  const [comfortAfter, setComfortAfter] = useState(comfortBefore)

  const tallyRef = useRef<Record<SmartSegment, SmartSegmentTally>>(EMPTY_TALLY())
  // Scheduled re-checks only — the reviewHealth signal, kept apart from the
  // per-segment tally the done screen shows.
  const retentionRef = useRef({ rated: 0, known: 0 })
  const packsRef = useRef<Set<string>>(new Set())
  const sessionEndedRef = useRef(false)

  const current = steps[stepIndex] ?? null
  const isLastStep = stepIndex >= steps.length - 1
  const card = current?.kind === 'card' ? current : null

  const { playWord, stop } = useAudio(card?.packageId ?? null, enRate, plRate)

  const finish = useCallback(async () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true

    const tally = tallyRef.current
    const ratedCount = tally.learn.rated + tally.review.rated + tally.stretch.rated
    const knownHitCount = tally.learn.known + tally.review.known + tally.stretch.known

    // Two signals, two questions. Comfort asks "is the NEW material the right
    // difficulty", so it reads learn + stretch only: "Nie znam" on a word being
    // met for the first time is the expected answer, and folding it in made the
    // number a function of how much new material the session happened to hold.
    // Health asks "is what I already learned still holding", so it reads the
    // scheduled re-checks and nothing else.
    const newRated = tally.learn.rated + tally.stretch.rated
    const newKnown = tally.learn.known + tally.stretch.known

    await saveSession({
      packageId: '__smart__',
      date: dayKey(),
      startedAt: new Date().toISOString(),
      wordsCompleted: ratedCount,
      mode: 'fiszki',
      trainMode: 'smart',
      durationSec: elapsedSec(),
      ratedCount,
      knownHitCount,
    })
    await recomputeMasteryFor([...packsRef.current])
    useAppStore.getState().applyTrainingOutcome({ ratedCount: newRated, knownHitCount: newKnown })
    useAppStore.getState().applyReviewOutcome(retentionRef.current)

    const store = useAppStore.getState()
    setComfortAfter(store.comfortLevel)

    if (ratedCount > 0) {
      const snapshot = await loadProgressSnapshot(true)
      const floor = store.todayLevel ?? 1
      const masteredPacksAtFloor = snapshot.packageProgress.filter(
        p => p.masteredAt != null && packLevelOf(p.packageId) === floor
      ).length
      const prompt = shouldPromptLevelUp({
        comfortLevel: store.comfortLevel,
        strongStreak: store.strongStreak,
        todayLevel: store.todayLevel,
        levelUpPrompt: store.levelUpPrompt,
        masteredPacksAtFloor,
      })
      setLevelUpTarget(prompt?.target ?? null)
    }

    setDone(true)
  }, [elapsedSec])

  const goNext = useCallback(async () => {
    if (isLastStep) {
      await finish()
    } else {
      setStepIndex(i => i + 1)
      resetToFront()
    }
  }, [isLastStep, finish, resetToFront])

  // Info hand-off cards auto-advance so the session doesn't stall on a tap
  // someone might miss — but still offer "Dalej" for anyone reading slower.
  useEffect(() => {
    if (current?.kind !== 'info') return
    const t = window.setTimeout(() => { void goNext() }, 2600)
    return () => window.clearTimeout(t)
  }, [current, goNext])

  const flipCard = useCallback(() => {
    if (!card) return
    const revealing = side === 'front'
    flip(() => {
      if (revealing) playWord(card.word)
      if (!revealing) stop()
    })
  }, [side, flip, card, playWord, stop])

  const answer = useCallback(async (recalled: boolean) => {
    if (!card || isAdvancing) return
    stop()

    const opts = { requestRetention: currentRequestRetention() }
    const updated = recalled
      ? applyKnown(card.progress, card.word.id, card.packageId, new Date(), opts)
      : applyUnknown(card.progress, card.word.id, card.packageId, new Date(), opts)
    await saveWordProgress(updated)

    const t = tallyRef.current[card.segment]
    t.rated += 1
    if (recalled) t.known += 1
    if (measuresRetention(card.segment, card.progress)) {
      retentionRef.current.rated += 1
      if (recalled) retentionRef.current.known += 1
    }
    packsRef.current.add(card.packageId)

    animateOut(async () => { await goNext() })
  }, [card, isAdvancing, stop, animateOut, goNext])

  const handleRepeat = useCallback(() => {
    setStepIndex(0)
    setDone(false)
    setLevelUpTarget(null)
    tallyRef.current = EMPTY_TALLY()
    retentionRef.current = { rated: 0, known: 0 }
    packsRef.current = new Set()
    sessionEndedRef.current = false
    resetToFront()
    setNonce(n => n + 1)
  }, [resetToFront])

  if (loading) {
    return (
      <div className="review__state">
        <div className="skeleton review__state-skeleton" />
        <p className="review__state-text">Buduję Twoją sesję…</p>
      </div>
    )
  }

  if (error || steps.length === 0) {
    return (
      <div className="review__state">
        <span className="review__state-icon" aria-hidden="true">✓</span>
        <h1 className="review__state-title">Nic do zrobienia</h1>
        <p className="review__state-text">
          {error ?? 'Wszystko na dziś zrobione — wróć jutro po więcej.'}
        </p>
        <div className="review__state-actions">
          <button className="review__state-btn review__state-btn--primary u-cta" onClick={() => navigate('/dzis')}>
            Wróć do Dzisiaj
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <>
        <SmartDoneScreen
          tally={tallyRef.current}
          comfortBefore={comfortBefore}
          comfortAfter={comfortAfter}
          onRepeat={handleRepeat}
          onExit={() => navigate('/dzis')}
        />
        {levelUpTarget != null && (
          <LevelUpPrompt
            target={levelUpTarget}
            onAccept={() => { useAppStore.getState().setTodayLevel(levelUpTarget); useAppStore.getState().dismissLevelUp(levelUpTarget) }}
            onDecline={() => { useAppStore.getState().dismissLevelUp(levelUpTarget); setLevelUpTarget(null) }}
          />
        )}
      </>
    )
  }

  if (current?.kind === 'info') {
    return <SmartInfoCard variant={current.variant} count={current.count} onNext={() => void goNext()} />
  }

  const flipped = side === 'back'

  const cardsBefore = steps.slice(0, stepIndex).filter(s => s.kind === 'card').length
  const cardTotal = steps.filter(s => s.kind === 'card').length

  return (
    <StudyStage
      tone="smart"
      kicker={<>Inteligentnie · {packCount} {plPackets(packCount)}</>}
      packageId={card?.packageId}
      counter={`${Math.min(cardsBefore + 1, cardTotal)} / ${cardTotal}`}
      rail={<SmartProgressRail steps={steps} stepIndex={stepIndex} />}
      onExit={() => { stop(); navigate('/dzis') }}
      exitLabel="Wróć do Dzisiaj"
      cardKey={stepIndex}
      polish={card?.word.polish ?? ''}
      english={card?.word.english ?? ''}
      side={side}
      cardClass={cardClass}
      onFlip={flipCard}
      onAnimationEnd={handleAnimationEnd}
      onPlay={() => { stop(); if (card) playWord(card.word) }}
      answersVisible={flipped && !isAdvancing}
      answersDisabled={isAdvancing}
      onAnswer={answer}
    />
  )
}
