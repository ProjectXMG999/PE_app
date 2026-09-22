import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useStudyClock } from '../hooks/useStudyClock'
import { useSmartSession } from '../hooks/useSmartSession'
import { useSessionOpener } from '../hooks/useSessionOpener'
import { useAppStore, currentRequestRetention } from '../store/useAppStore'
import { applyKnown, applyUnknown } from '../services/review'
import { saveSession, saveWordProgress, getWordProgress } from '../services/db'
import { recomputeMasteryFor } from '../services/masteryRepair'
import { shouldPromptLevelUp } from '../services/comfort'
import { showToast } from '../services/toast'
import { loadProgressSnapshot, packLevelOf } from '../hooks/useProgressData'
import { dayKey } from '../utils/day'
import { SmartSegment } from '../services/smartQueue'
import { record as recordOutcome, summarize, CardOutcome } from '../services/smartOutcome'
import { SmartInfoCard } from '../components/smart/SmartInfoCard'
import { SmartProgressRail } from '../components/smart/SmartProgressRail'
import { SmartDoneScreen, SmartSegmentTally } from '../components/smart/SmartDoneScreen'
import { SmartSessionOpener } from '../components/smart/SmartSessionOpener'
import { SessionStage } from '../components/flashcard/SessionStage'
import { LevelUpPrompt } from '../components/today/LevelUpPrompt'
import { StudyStage } from '../components/flashcard/StudyStage'
import { useSentenceCardProps } from '../hooks/useSentenceCardProps'
import { plPackets } from '../utils/packVisuals'
import { useBack } from '../navigation/navigation'
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
  // Launched from Dzisiaj, so that's where the way out leads — by popping
  // back to it rather than stacking another copy on top of the session.
  const { goBack, backLabel } = useBack()
  const { enRate, plRate } = useAppStore()
  const [nonce, setNonce] = useState(0)
  const { steps, packCount, preview, opensWith, missing, loading, error } = useSmartSession(nonce)
  // This mode has no loading screen of its own any more — the curtain is it.
  const { visible: openerVisible, settled, dismiss: dismissOpener } = useSessionOpener(!loading)

  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [levelUpTarget, setLevelUpTarget] = useState<number | null>(null)
  const [comfortBefore] = useState(() => useAppStore.getState().comfortLevel)
  // Captured on entry alongside comfortBefore: the done screen reads comfort
  // against the level the session was actually built for, and changing the
  // floor mid-session would otherwise re-anchor the verdict.
  const [sessionLevel] = useState(() => useAppStore.getState().todayLevel ?? 1)
  const [comfortAfter, setComfortAfter] = useState(comfortBefore)
  // Reviews still owed today once this sitting is folded in. Read off the
  // snapshot `finish` already loads, so it costs no extra IO.
  const [reviewsLeft, setReviewsLeft] = useState<number | null>(null)

  const tallyRef = useRef<Record<SmartSegment, SmartSegmentTally>>(EMPTY_TALLY())
  // What each answer did to the word's schedule — the done screen's "what
  // changed" half. Kept out of `tallyRef` because it is nobody else's business:
  // no signal, no Session row and no sync reads it.
  const outcomesRef = useRef<CardOutcome[]>([])
  // Scheduled re-checks only — the reviewHealth signal, kept apart from the
  // per-segment tally the done screen shows.
  const retentionRef = useRef({ rated: 0, known: 0 })
  const packsRef = useRef<Set<string>>(new Set())
  const sessionEndedRef = useRef(false)
  // What has already been written to a Session row, so a second write records
  // the delta rather than the whole run again.
  const savedRef = useRef({ rated: 0, known: 0, sec: 0 })
  // Comfort / review-health fold once per sitting — see `foldSignals`.
  const signalsFoldedRef = useRef(false)

  // Folded once, when the sitting ends. It was being recomputed inline in the
  // done screen's JSX, i.e. on every one of that screen's renders — and the
  // screen animates, so that is a full pass over the run's outcomes per frame
  // of the entrance cascade. `done` is the only thing that can change the
  // answer: the outcomes ref is frozen by then, and `handleRepeat` flips it
  // back to false before refilling it.
  const outcome = useMemo(() => summarize(outcomesRef.current), [done])

  const current = steps[stepIndex] ?? null
  const isLastStep = stepIndex >= steps.length - 1
  const card = current?.kind === 'card' ? current : null

  const { playWord, playSentence, playWordPl, playSentencePl, stop } = useAudio(card?.packageId ?? null, enRate, plRate)
  const sentenceProps = useSentenceCardProps(card?.word, { stop, playSentence, playSentencePl, playWordPl })

  /**
   * Writes everything answered since the last write to a Session row.
   *
   * Separate from `finish` because a sitting ends when the learner leaves, not
   * only when the last card is answered — and `finish` used to be the ONLY
   * place that wrote one. Nothing was lost per word (every answer saves its own
   * WordProgress), but the *session* was, and half the app is derived from
   * session rows: `sevenDayPace` feeds `computeReviewBudget`, so a run of
   * abandoned sessions pinned the daily review budget at its floor — which is
   * how Dzisiaj came to say "Porcja na dziś zrobiona" after a handful of words
   * while the hero above it still offered a full session.
   *
   * Idempotent: a second call with nothing new answered writes nothing.
   */
  const persistProgress = useCallback(async () => {
    const tally = tallyRef.current
    const rated = tally.learn.rated + tally.review.rated + tally.stretch.rated
    const known = tally.learn.known + tally.review.known + tally.stretch.known
    const saved = savedRef.current
    if (rated <= saved.rated) return

    const sec = elapsedSec()
    savedRef.current = { rated, known, sec }

    await saveSession({
      packageId: '__smart__',
      date: dayKey(),
      startedAt: new Date().toISOString(),
      wordsCompleted: rated - saved.rated,
      mode: 'fiszki',
      trainMode: 'smart',
      durationSec: Math.max(0, sec - saved.sec),
      ratedCount: rated - saved.rated,
      knownHitCount: known - saved.known,
    })
    await recomputeMasteryFor([...packsRef.current])
  }, [elapsedSec])

  /**
   * Folds the sitting into the two adaptive signals. Once per sitting, on the
   * cumulative totals — `updateComfort` and `strongStreakNext` are defined per
   * *session*, so folding partial batches would let one run rack up the three
   * "strong sessions" the level-up prompt waits for.
   *
   * Two signals, two questions. Comfort asks "is the NEW material the right
   * difficulty", so it reads learn + stretch only: "Nie znam" on a word being
   * met for the first time is the expected answer, and folding it in made the
   * number a function of how much new material the session happened to hold.
   * Health asks "is what I already learned still holding", so it reads the
   * scheduled re-checks and nothing else.
   */
  const foldSignals = useCallback(() => {
    if (signalsFoldedRef.current) return
    const tally = tallyRef.current
    const newRated = tally.learn.rated + tally.stretch.rated
    if (newRated === 0 && retentionRef.current.rated === 0) return
    signalsFoldedRef.current = true

    const newKnown = tally.learn.known + tally.stretch.known
    useAppStore.getState().applyTrainingOutcome({ ratedCount: newRated, knownHitCount: newKnown })
    useAppStore.getState().applyReviewOutcome(retentionRef.current)
  }, [])

  // Leaving mid-session is an ordinary way to end one, so it saves like one.
  // `pagehide` covers the tab being killed while backgrounded (the cost is an
  // extra Session row if they come back and finish — every consumer sums rows,
  // so only the Statystyki session count notices). Signals fold on unmount
  // only: a mid-run fold would lock out the rest of the sitting.
  useEffect(() => {
    const onHide = () => { void persistProgress() }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void persistProgress()
      foldSignals()
    }
  }, [persistProgress, foldSignals])

  const finish = useCallback(async () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true

    const tally = tallyRef.current
    const ratedCount = tally.learn.rated + tally.review.rated + tally.stretch.rated

    await persistProgress()
    foldSignals()

    // Read AFTER foldSignals, so the verdict includes this sitting.
    const store = useAppStore.getState()
    setComfortAfter(store.comfortLevel)

    if (ratedCount > 0) {
      const snapshot = await loadProgressSnapshot(true)
      // Forced re-read, so this already reflects every word just answered.
      setReviewsLeft(snapshot.servingLeft)
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
  }, [persistProgress, foldSignals])

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
  //
  // Not while the curtain is up. `composeSmartSteps` no longer puts a hand-off
  // card at step 0, so this shouldn't be reachable — but when it WAS, this
  // timer and the curtain's hold both started in the same commit and the card
  // spent more than half its life behind an opaque screen. A dwell timer for
  // something nobody can see is never what was meant.
  useEffect(() => {
    if (current?.kind !== 'info' || openerVisible) return
    const t = window.setTimeout(() => { void goNext() }, 2600)
    return () => window.clearTimeout(t)
  }, [current, goNext, openerVisible])

  // A session that ran short because content didn't arrive says so. Silence
  // here is what made a 14-word sitting that delivered one card look like the
  // mode's own idea of a session rather than a failed download.
  useEffect(() => {
    if (loading || missing === 0 || steps.length === 0) return
    showToast(
      `Nie udało się pobrać treści ${missing === 1 ? 'jednej paczki' : `${missing} paczek`} — sesja jest krótsza.`,
      { icon: '⚠' }
    )
  }, [loading, missing, steps.length])

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
    // Read the row now rather than using `card.progress`, which was captured
    // when the session was built. If the same word is answered twice in one
    // sitting the second answer would otherwise be computed from the state
    // before the first and overwrite it. `card.progress` is still the right
    // input for the quality signals below — those ask what the word looked
    // like when the session started.
    const existing = await getWordProgress(card.word.id)
    const updated = recalled
      ? applyKnown(existing, card.word.id, card.packageId, new Date(), opts)
      : applyUnknown(existing, card.word.id, card.packageId, new Date(), opts)
    await saveWordProgress(updated)

    const t = tallyRef.current[card.segment]
    t.rated += 1
    if (recalled) t.known += 1
    outcomesRef.current.push(recordOutcome({
      segment: card.segment,
      before: card.progress,
      after: updated,
      recalled,
    }))
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
    outcomesRef.current = []
    retentionRef.current = { rated: 0, known: 0 }
    packsRef.current = new Set()
    sessionEndedRef.current = false
    // "Jeszcze raz" is a new sitting: its own session row, its own fold. The
    // study clock isn't reset by a repeat, so the seconds baseline carries over
    // — otherwise the second run would re-bill the first run's minutes.
    savedRef.current = { rated: 0, known: 0, sec: elapsedSec() }
    signalsFoldedRef.current = false
    resetToFront()
    setNonce(n => n + 1)
  }, [resetToFront, elapsedSec])

  // Every branch below renders under the same curtain, so this page has exactly
  // one return. An early return above <SessionStage> would tear the curtain
  // off un-animated on precisely the paths that need it to lift gracefully —
  // the empty and error screens.
  function body() {
    if (error || steps.length === 0) {
      // A session that couldn't be built is not a finished one. It used to say
      // "Nic do zrobienia — wróć jutro" either way, which turned a failed fetch
      // into a false all-clear and sent the learner away from work that was
      // waiting for them.
      const failed = error != null
      return (
        <div className="review__state">
          <span className="review__state-icon" aria-hidden="true">{failed ? '⚠' : '✓'}</span>
          <h1 className="review__state-title">
            {failed ? 'Nie udało się przygotować sesji' : 'Nic do zrobienia'}
          </h1>
          <p className="review__state-text">
            {error ?? 'Wszystko na dziś zrobione — wróć jutro po więcej.'}
          </p>
          <div className="review__state-actions">
            {failed && (
              <button
                className="review__state-btn review__state-btn--primary u-cta"
                onClick={() => setNonce(n => n + 1)}
              >
                Spróbuj ponownie
              </button>
            )}
            <button
              className={`review__state-btn${failed ? '' : ' review__state-btn--primary u-cta'}`}
              onClick={() => goBack()}
            >
              {backLabel}
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
            outcome={outcome}
            comfortBefore={comfortBefore}
            comfortAfter={comfortAfter}
            reviewsLeft={reviewsLeft}
            level={sessionLevel}
            onRepeat={handleRepeat}
            onExit={() => goBack()}
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
        onExit={() => { stop(); goBack() }}
        exitLabel={backLabel}
        cardKey={stepIndex}
        polish={card?.word.polish ?? ''}
        english={card?.word.english ?? ''}
        side={side}
        cardClass={cardClass}
        onFlip={flipCard}
        onAnimationEnd={handleAnimationEnd}
        onPlay={() => { stop(); if (card) playWord(card.word) }}
        {...sentenceProps}
        answersVisible={flipped && !isAdvancing}
        answersDisabled={isAdvancing}
        onAnswer={answer}
        covered={openerVisible}
      />
    )
  }

  return (
    <SessionStage
      tone="smart"
      settled={settled}
      openerVisible={openerVisible}
      opener={
        <SmartSessionOpener
          key="opener"
          preview={preview}
          opensWith={opensWith}
          ready={settled}
          onDone={dismissOpener}
        />
      }
    >
      {body}
    </SessionStage>
  )
}
