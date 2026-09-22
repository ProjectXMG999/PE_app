import { useCallback, useEffect, useRef, useState } from 'react'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useStudyClock } from '../hooks/useStudyClock'
import { useReviewSet, ReviewInterludeStep } from '../hooks/useReviewSet'
import { useSessionOpener } from '../hooks/useSessionOpener'
import { useStudyPad } from '../hooks/useStudyPad'
import { useAppStore, currentRequestRetention } from '../store/useAppStore'
import { applyKnown, applyUnknown } from '../services/review'
import { saveSession, saveWordProgress, getWordProgress } from '../services/db'
import { dayKey } from '../utils/day'
import { plPackets } from '../utils/packVisuals'
import { plWords } from '../utils/plural'
import { StudyStage, StageTrack } from '../components/flashcard/StudyStage'
import { SessionOpener } from '../components/flashcard/SessionOpener'
import { SessionStage } from '../components/flashcard/SessionStage'
import { ReviewCheckpoint } from '../components/flashcard/ReviewCheckpoint'
import { useBack } from '../navigation/navigation'
import './ReviewPage.css'

/**
 * The review session: words the schedule says are slipping, pulled from
 * wherever on the route they live, plus optional passive listening breaks.
 *
 * Shares WordFlashPage's card markup and stylesheet — the interaction is
 * identical and duplicating it would just mean two things to keep in sync. What
 * differs is that there's no single pack here: each card carries its own
 * packageId, which is what the audio hook is keyed on.
 *
 * The daily serving is capped (see reviewQueue), so a run ends on a checkpoint:
 * how much was done, how much is still in the queue, and a choice to keep going
 * past the day's budget or stop.
 */
export function ReviewPage() {
  // Launched from Dzisiaj, so that's where the way out leads — by popping
  // back to it rather than stacking another copy on top of the session.
  const { goBack, backLabel } = useBack()
  const { enRate, plRate } = useAppStore()

  const [overBudget, setOverBudget] = useState(false)
  const [round, setRound] = useState(0)
  const { steps, cardCount, dueTotal, packCount, reviewBudget, servedBefore, exhausted, loading, error } =
    useReviewSet(true, { overBudget, nonce: round })
  // This mode has no loading screen of its own any more — the curtain is it.
  const { visible: openerVisible, settled, dismiss: dismissOpener } = useSessionOpener(!loading)

  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [stepIndex, setStepIndex] = useState(0)
  const [kept, setKept] = useState(0)
  // Scheduled re-checks in this batch — the reviewHealth signal. Narrower than
  // `kept`: the due queue also carries words that were never mastered (a
  // "Nie znam" reschedules a learning word too), and those say nothing about
  // retention. `status: 'known'` is permanent, so it's the honest test.
  const retentionRef = useRef({ rated: 0, known: 0 })
  const [batchDone, setBatchDone] = useState(false)

  // The pad takes over from the curtain's chord — in the neutral key, the one
  // the curtain already sounds in here: a review set spans packs of every
  // level, so there is no level for it to be in. See hooks/useStudyPad.ts.
  useStudyPad(!openerVisible && !batchDone && !error, null)
  // The clock runs for the whole visit, but `wordsCompleted` is per batch, so a
  // session row must record only its own slice — otherwise batch 3 of a visit
  // claims all three batches' minutes against twenty cards, and the sec/card
  // ratio `reviewSecPerCard` reads off those rows inflates with every
  // "Kontynuuj mimo to".
  const batchStartSec = useRef(0)
  const [noAudio, setNoAudio] = useState(false)
  // Cumulative across every batch of this visit.
  const [sessionSeen, setSessionSeen] = useState(0)
  const [sessionKept, setSessionKept] = useState(0)

  const current = steps[stepIndex] ?? null
  const isLastStep = stepIndex >= steps.length - 1
  const cardsBefore = steps.slice(0, stepIndex).filter(s => s.kind === 'card').length

  const card = current?.kind === 'card' ? current : null

  // Audio is keyed on the current card's own pack, since a review set spans many.
  const { playWord, stop } = useAudio(card?.packageId ?? null, enRate, plRate)

  const finishBatch = useCallback(async () => {
    const batchSec = Math.max(0, elapsedSec() - batchStartSec.current)
    await saveSession({
      // Not a real pack — this session spans many, so it gets its own marker
      // rather than being attributed to whichever pack came first.
      packageId: '__review__',
      date: dayKey(),
      startedAt: new Date().toISOString(),
      wordsCompleted: cardCount,
      mode: 'fiszki',
      trainMode: 'review',
      durationSec: batchSec,
      // Recorded for stats. The adaptive difficulty signal ignores review
      // sessions (it only reads trainMode word-flash / active-sentence).
      ratedCount: cardCount,
      knownHitCount: kept,
    })
    useAppStore.getState().applyReviewOutcome(retentionRef.current)
    retentionRef.current = { rated: 0, known: 0 }
    setSessionSeen(n => n + cardCount)
    setSessionKept(k => k + kept)
    setBatchDone(true)
  }, [cardCount, kept, elapsedSec])

  const goNext = useCallback(async () => {
    if (isLastStep) {
      await finishBatch()
    } else {
      setStepIndex(i => i + 1)
      resetToFront()
    }
  }, [isLastStep, finishBatch, resetToFront])

  // Skip listening interludes entirely once the user opts out for this run.
  useEffect(() => {
    if (current?.kind === 'interlude' && noAudio) void goNext()
  }, [current, noAudio, goNext])

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
    // Fresh read rather than `card.progress`, which is the snapshot the set was
    // built from — see the same note in SmartSessionPage. The retention signal
    // below deliberately keeps reading the snapshot.
    const existing = await getWordProgress(card.word.id)
    const updated = recalled
      ? applyKnown(existing, card.word.id, card.packageId, new Date(), opts)
      : applyUnknown(existing, card.word.id, card.packageId, new Date(), opts)
    await saveWordProgress(updated)
    if (recalled) setKept(k => k + 1)
    if (card.progress?.status === 'known') {
      retentionRef.current.rated += 1
      if (recalled) retentionRef.current.known += 1
    }

    animateOut(async () => { await goNext() })
  }, [card, isAdvancing, stop, animateOut, goNext])

  const continueBatch = useCallback(() => {
    // Start the next batch's clock here, not when the last one was saved, so
    // the time spent reading the checkpoint belongs to neither batch's pace.
    batchStartSec.current = elapsedSec()
    setStepIndex(0)
    setKept(0)
    setBatchDone(false)
    setOverBudget(true)
    setRound(r => r + 1)
  }, [elapsedSec])

  // Every branch below renders under the same curtain, so this page has
  // exactly one return. An early return above <SessionStage> would tear the
  // curtain off un-animated on precisely the paths that need it to lift
  // gracefully — the empty and checkpoint screens.
  function body() {
    // Nothing to show: either a genuinely fresh route, an error, or today's budget
    // is already spent (in which case the user can still opt to keep going).
    if (error || cardCount === 0) {
      const title = error
        ? 'Nie udało się wczytać powtórki'
        : exhausted
          ? 'Dzisiejsza porcja zrobiona'
          : 'Nic nie czeka na powtórkę'
      const text = error
        ? error
        : exhausted
          ? `Na dziś tyle. W kolejce jeszcze ${dueTotal} — wrócą w kolejnych dniach.`
          : 'Cała Twoja trasa jest świeża. Wróć, gdy coś dojrzeje.'
      return (
        <div className="review__state">
          <span className="review__state-icon" aria-hidden="true">{exhausted ? '🔁' : '✓'}</span>
          <h1 className="review__state-title">{title}</h1>
          <p className="review__state-text">{text}</p>
          <div className="review__state-actions">
            {exhausted && dueTotal > 0 && (
              <button
                className="review__state-btn review__state-btn--primary u-cta"
                onClick={continueBatch}
              >
                Kontynuuj mimo to
              </button>
            )}
            <button className="review__state-btn" onClick={() => goBack()}>
              {backLabel}
            </button>
          </div>
        </div>
      )
    }

    // Checkpoint after each finished batch — do you want to keep going?
    if (batchDone) {
      const queueLeft = Math.max(0, dueTotal - cardCount)
      // Once the day's portion is done, stop nudging "keep going" — swap the
      // buttons so "enough for today" is the primary, and reassure.
      //
      // Counted against the whole day, not just this visit. `sessionSeen` alone
      // was right only while one sitting could cover a day's budget; now that the
      // day's ceiling is the goal (72 at the largest) and a sitting is capped at
      // REVIEW_MAX_WORDS, a learner returning for their second batch would have
      // been nudged to "keep going" all the way past a portion they had in fact
      // already finished.
      const doneToday = servedBefore + sessionSeen
      const portionDone = reviewBudget > 0 && doneToday >= reviewBudget
      return (
        <ReviewCheckpoint
          kept={kept}
          cardCount={cardCount}
          doneToday={doneToday}
          reviewBudget={reviewBudget}
          queueLeft={queueLeft}
          portionDone={portionDone}
          onContinue={continueBatch}
          onStop={() => goBack()}
          stopLabel={queueLeft > 0 ? 'Na dziś wystarczy' : backLabel}
        />
      )
    }

    const progressPct = cardCount > 0 ? (cardsBefore / cardCount) * 100 : 0

    if (current?.kind === 'interlude') {
      return (
        <ReviewInterlude
          step={current}
          enRate={enRate}
          plRate={plRate}
          onDone={() => void goNext()}
          onDisableAudio={() => setNoAudio(true)}
        />
      )
    }

    const flipped = side === 'back'

    return (
      <StudyStage
        tone="review"
        kicker={
          <>
            Powtórka · {packCount} {plPackets(packCount)}
            {dueTotal > cardCount && ` · ${dueTotal - cardCount} w kolejce`}
          </>
        }
        packageId={card?.packageId}
        counter={`${cardsBefore + 1} / ${cardCount}`}
        rail={<StageTrack current={progressPct} />}
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
        answersVisible={flipped && !isAdvancing}
        answersDisabled={isAdvancing}
        onAnswer={answer}
        covered={openerVisible}
      />
    )
  }

  return (
    <SessionStage
      tone="review"
      settled={settled}
      openerVisible={openerVisible}
      opener={
        <SessionOpener
          key="opener"
          accent="var(--live)"
          kicker="Powtórka"
          title="Dzisiejsza porcja"
          meta={
            cardCount > 0
              ? <>{cardCount} {plWords(cardCount)} · {packCount} {plPackets(packCount)}</>
              : undefined
          }
          // It used to say nothing here — "a line replaced by the real one a
          // moment later is a second entrance". It isn't one any more: the two
          // cross-fade inside the same reserved line box, so what the learner
          // sees is one line changing what it says, and the alternative was a
          // curtain that states the mode and then withholds why it is waiting.
          waiting="Zbieram dzisiejszą porcję…"
          ready={settled}
          onDone={dismissOpener}
        />
      }
    >
      {body}
    </SessionStage>
  )
}

/**
 * A passive listening break inside the review run. Plays each word PL→EN with the
 * text on screen (so it half-works muted), auto-advancing. Never touches
 * WordProgress. Always skippable; "Bez słuchania" turns off every later break.
 */
function ReviewInterlude({
  step, enRate, plRate, onDone, onDisableAudio,
}: {
  step: ReviewInterludeStep
  enRate: number
  plRate: number
  onDone: () => void
  onDisableAudio: () => void
}) {
  const [i, setI] = useState(0)
  const w = step.words[i] ?? null
  const { playWordPl, playWord, stop } = useAudio(w?.packageId ?? null, enRate, plRate)

  useEffect(() => {
    if (!w) return
    let alive = true
    // Minimum time each word stays on screen, whether or not the clip plays —
    // so a muted user (or a missing/404 audio file) still gets time to read.
    const PL_DWELL = 1600
    const EN_DWELL = 600
    const padTo = (ms: number, since: number) =>
      new Promise(r => setTimeout(r, Math.max(0, ms - (Date.now() - since))))
    ;(async () => {
      const t0 = Date.now()
      await playWordPl(w.word)
      if (!alive) return
      await padTo(PL_DWELL, t0)
      if (!alive) return
      const t1 = Date.now()
      await playWord(w.word)
      if (!alive) return
      await padTo(EN_DWELL, t1)
      if (!alive) return
      if (i < step.words.length - 1) setI(n => n + 1)
      else onDone()
    })()
    return () => { alive = false; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step])

  return (
    <div className="review__state review__interlude">
      <span className="review__interlude-eyebrow">🎧 Chwila słuchania · {step.words.length} słów</span>
      <ol className="review__interlude-list">
        {step.words.map((x, idx) => (
          <li
            key={x.word.id}
            className={`review__interlude-item${idx === i ? ' review__interlude-item--active' : ''}`}
          >
            <span className="review__interlude-pl">{x.word.polish}</span>
            <span className="review__interlude-en">{x.word.english}</span>
          </li>
        ))}
      </ol>
      <div className="review__state-actions">
        <button className="review__state-btn review__state-btn--primary u-cta" onClick={() => { stop(); onDone() }}>
          Pomiń
        </button>
        <button className="review__state-btn" onClick={() => { stop(); onDisableAudio() }}>
          Bez słuchania
        </button>
      </div>
    </div>
  )
}
