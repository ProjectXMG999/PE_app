import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudio } from '../hooks/useAudio'
import { useCardFlip } from '../hooks/useCardFlip'
import { useStudyClock } from '../hooks/useStudyClock'
import { useReviewSet, REVIEW_MAX_WORDS } from '../hooks/useReviewSet'
import { useAppStore } from '../store/useAppStore'
import { applyKnown, applyUnknown } from '../services/review'
import { saveSession, saveWordProgress } from '../services/db'
import { dayKey } from '../utils/day'
import './WordFlashPage.css'
import './ReviewPage.css'

/**
 * The review session: words the schedule says are slipping, pulled from
 * wherever on the route they live.
 *
 * Shares WordFlashPage's card markup and stylesheet — the interaction is
 * identical and duplicating it would just mean two things to keep in sync. What
 * differs is that there's no pack here: each card carries its own packageId,
 * which is what the audio hook is keyed on.
 */
export function ReviewPage() {
  const navigate = useNavigate()
  const { enRate, plRate } = useAppStore()
  const { items, dueTotal, packCount, loading, error } = useReviewSet()
  const { side, isAdvancing, flip, advance: animateOut, resetToFront, handleAnimationEnd, cardClass } = useCardFlip()
  const { elapsedSec } = useStudyClock()

  const [index, setIndex] = useState(0)
  const [kept, setKept] = useState(0)
  const [done, setDone] = useState(false)

  const current = items[index] ?? null
  const total = items.length
  const isLast = index >= total - 1

  // Audio is keyed on the current card's own pack, since a review set spans many.
  const { playWord, stop } = useAudio(current?.packageId ?? null, enRate, plRate)

  const flipCard = useCallback(() => {
    const revealing = side === 'front'
    flip(() => {
      if (revealing && current) playWord(current.word)
      if (!revealing) stop()
    })
  }, [side, flip, current, playWord, stop])

  const answer = useCallback(async (recalled: boolean) => {
    if (!current || isAdvancing) return
    stop()

    const updated = recalled
      ? applyKnown(current.progress, current.word.id, current.packageId)
      : applyUnknown(current.progress, current.word.id, current.packageId)
    await saveWordProgress(updated)
    if (recalled) setKept(k => k + 1)

    animateOut(async () => {
      if (isLast) {
        await saveSession({
          // Not a real pack — this session spans many, so it gets its own marker
          // rather than being attributed to whichever pack came first.
          packageId: '__review__',
          date: dayKey(),
          startedAt: new Date().toISOString(),
          wordsCompleted: total,
          mode: 'fiszki',
          trainMode: 'review',
          durationSec: elapsedSec(),
        })
        setDone(true)
      } else {
        setIndex(i => i + 1)
        resetToFront()
      }
    })
  }, [current, isAdvancing, isLast, total, stop, animateOut, resetToFront, elapsedSec])

  if (loading) {
    return (
      <div className="review__state">
        <div className="skeleton review__state-skeleton" />
        <p className="review__state-text">Zbieram słowa do powtórki…</p>
      </div>
    )
  }

  if (error || total === 0) {
    return (
      <div className="review__state">
        <span className="review__state-icon" aria-hidden="true">✓</span>
        <h1 className="review__state-title">
          {error ? 'Nie udało się wczytać powtórki' : 'Nic nie czeka na powtórkę'}
        </h1>
        <p className="review__state-text">
          {error ?? 'Cała Twoja trasa jest świeża. Wróć, gdy coś dojrzeje.'}
        </p>
        <button className="review__state-btn" onClick={() => navigate('/dzis')}>
          Wróć do Dzisiaj
        </button>
      </div>
    )
  }

  if (done) {
    const remaining = Math.max(0, dueTotal - total)
    return (
      <div className="review__state">
        <span className="review__state-icon" aria-hidden="true">🔁</span>
        <h1 className="review__state-title">Powtórka zrobiona</h1>
        <p className="review__state-text">
          Utrzymane: <strong>{kept}</strong> z {total}.
          {remaining > 0 && ` Zostało jeszcze ${remaining} do powtórki.`}
        </p>
        <div className="review__state-actions">
          {remaining > 0 && (
            <button
              className="review__state-btn review__state-btn--primary"
              onClick={() => {
                // Remount with a fresh queue rather than reusing spent state.
                setIndex(0); setKept(0); setDone(false)
                navigate(0)
              }}
            >
              Kolejna powtórka
            </button>
          )}
          <button className="review__state-btn" onClick={() => navigate('/dzis')}>
            Wróć do Dzisiaj
          </button>
        </div>
      </div>
    )
  }

  const progressPct = total > 0 ? (index / total) * 100 : 0
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
        <span className="wf__counter">{index + 1} / {total}</span>
      </div>

      <p className="review__badge">
        🔁 Powtórka · {packCount} {packCount === 1 ? 'paczka' : 'paczek'}
        {dueTotal > REVIEW_MAX_WORDS && ` · ${dueTotal} zaległych`}
      </p>

      <div className="wf__scene">
        <div
          key={index}
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
                <p className="wf__word wf__word--pl">{current?.word.polish}</p>
              </div>
              <p className="wf__tap-hint">Powiedz po angielsku. Potem odsłoń.</p>
            </div>
          ) : (
            <div className="wf__face wf__face--back">
              <span className="wf__lang-badge wf__lang-badge--en">EN</span>
              <div className="wf__content">
                <div className="wf__word-row">
                  <p className="wf__word wf__word--en">{current?.word.english}</p>
                  <button
                    className="wf__play wf__play--accent"
                    onClick={e => { e.stopPropagation(); stop(); if (current) playWord(current.word) }}
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
