import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useStudyClock } from '../hooks/useStudyClock'
import { useReviewSet, ReviewInterludeStep } from '../hooks/useReviewSet'
import { useAppStore } from '../store/useAppStore'
import { applyKnown, applyUnknown } from '../services/review'
import { saveSession, saveWordProgress } from '../services/db'
import { dayKey } from '../utils/day'
import './WordFlashPage.css'
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
  const navigate = useNavigate()
  const { enRate, plRate } = useAppStore()

  const [overBudget, setOverBudget] = useState(false)
  const [round, setRound] = useState(0)
  const { steps, cardCount, dueTotal, packCount, reviewBudget, exhausted, loading, error } =
    useReviewSet(true, { overBudget, nonce: round })

  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [stepIndex, setStepIndex] = useState(0)
  const [kept, setKept] = useState(0)
  const [batchDone, setBatchDone] = useState(false)
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
    await saveSession({
      // Not a real pack — this session spans many, so it gets its own marker
      // rather than being attributed to whichever pack came first.
      packageId: '__review__',
      date: dayKey(),
      startedAt: new Date().toISOString(),
      wordsCompleted: cardCount,
      mode: 'fiszki',
      trainMode: 'review',
      durationSec: elapsedSec(),
    })
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

    const updated = recalled
      ? applyKnown(card.progress, card.word.id, card.packageId)
      : applyUnknown(card.progress, card.word.id, card.packageId)
    await saveWordProgress(updated)
    if (recalled) setKept(k => k + 1)

    animateOut(async () => { await goNext() })
  }, [card, isAdvancing, stop, animateOut, goNext])

  const continueBatch = useCallback(() => {
    setStepIndex(0)
    setKept(0)
    setBatchDone(false)
    setOverBudget(true)
    setRound(r => r + 1)
  }, [])

  if (loading) {
    return (
      <div className="review__state">
        <div className="skeleton review__state-skeleton" />
        <p className="review__state-text">Zbieram słowa do powtórki…</p>
      </div>
    )
  }

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
              className="review__state-btn review__state-btn--primary"
              onClick={continueBatch}
            >
              Kontynuuj mimo to
            </button>
          )}
          <button className="review__state-btn" onClick={() => navigate('/dzis')}>
            Wróć do Dzisiaj
          </button>
        </div>
      </div>
    )
  }

  // Checkpoint after each finished batch — do you want to keep going?
  if (batchDone) {
    const queueLeft = Math.max(0, dueTotal - cardCount)
    const totalToday = sessionSeen
    // Once the day's portion is done, stop nudging "keep going" — swap the
    // buttons so "enough for today" is the primary, and reassure.
    const portionDone = reviewBudget > 0 && sessionSeen >= reviewBudget
    const continueBtn = (
      <button
        className={`review__state-btn${portionDone ? '' : ' review__state-btn--primary'}`}
        onClick={continueBatch}
      >
        Kontynuuj powtórkę
      </button>
    )
    const stopBtn = (
      <button
        className={`review__state-btn${portionDone ? ' review__state-btn--primary' : ''}`}
        onClick={() => navigate('/dzis')}
      >
        {queueLeft > 0 ? 'Na dziś wystarczy' : 'Wróć do Dzisiaj'}
      </button>
    )
    return (
      <div className="review__state">
        <span className="review__state-icon" aria-hidden="true">{queueLeft > 0 ? '💪' : '🎉'}</span>
        <h1 className="review__state-title">
          {queueLeft > 0 ? 'Świetnie!' : 'Wszystko zrobione!'}
        </h1>
        <p className="review__state-text">
          Utrzymane <strong>{kept}</strong> z {cardCount} w tej porcji
          {totalToday > cardCount && ` · dziś łącznie ${totalToday}`}.
          {queueLeft > 0 ? ` W kolejce jeszcze ${queueLeft}.` : ' Kolejka pusta.'}
          {portionDone && queueLeft > 0 &&
            ` Zrobiłeś dziś ${sessionSeen} — reszta spokojnie może poczekać.`}
        </p>
        <div className="review__state-actions">
          {queueLeft > 0 && (portionDone ? <>{stopBtn}{continueBtn}</> : <>{continueBtn}{stopBtn}</>)}
          {queueLeft === 0 && stopBtn}
        </div>
      </div>
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
    <div className="wf">
      <div className="wf__header">
        <button className="wf__back" onClick={() => { stop(); navigate('/dzis') }} aria-label="Wróć">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="wf__progress-bar">
          <div className="wf__progress-current" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="wf__counter">{cardsBefore + 1} / {cardCount}</span>
      </div>

      <p className="review__badge">
        🔁 Powtórka · {packCount} {packCount === 1 ? 'paczka' : 'paczek'}
        {dueTotal > cardCount && ` · ${dueTotal - cardCount} w kolejce`}
      </p>

      <div className="wf__scene">
        <div
          key={stepIndex}
          className={`wf__card${cardClass('wf__card')}`}
          onClick={flipCard}
          onAnimationEnd={handleAnimationEnd}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && flipCard()}
        >
          {side === 'front' ? (
            <div className="wf__face wf__face--front">
              <span className="wf__lang-badge wf__lang-badge--pl">PL</span>
              <div className="wf__content">
                <p className="wf__word wf__word--pl">{card?.word.polish}</p>
              </div>
              <p className="wf__tap-hint">Powiedz po angielsku. Potem odsłoń.</p>
            </div>
          ) : (
            <div className="wf__face wf__face--back">
              <span className="wf__lang-badge wf__lang-badge--en">EN</span>
              <div className="wf__content">
                <div className="wf__word-row">
                  <p className="wf__word wf__word--en">{card?.word.english}</p>
                  <button
                    className="wf__play wf__play--accent"
                    onClick={e => { e.stopPropagation(); stop(); if (card) playWord(card.word) }}
                    aria-label="Wymowa EN"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  </button>
                </div>
              </div>
              <p className="wf__tap-hint">dotknij, aby zobaczyć przód</p>
            </div>
          )}
        </div>
      </div>

      <div className={`wf__actions${flipped && !isAdvancing ? ' wf__actions--visible' : ''}`}>
        <button className="wf__btn wf__btn--unknown" onClick={() => answer(false)} disabled={isAdvancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Nie pamiętam
        </button>
        <button className="wf__btn wf__btn--known" onClick={() => answer(true)} disabled={isAdvancing}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Pamiętam
        </button>
      </div>
    </div>
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
        <button className="review__state-btn review__state-btn--primary" onClick={() => { stop(); onDone() }}>
          Pomiń
        </button>
        <button className="review__state-btn" onClick={() => { stop(); onDisableAudio() }}>
          Bez słuchania
        </button>
      </div>
    </div>
  )
}
