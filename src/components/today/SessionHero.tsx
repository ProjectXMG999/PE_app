import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FlowNumber } from '../shared/FlowNumber'
import { smartPeek, smartReason } from '../../services/smartQueue'
import { useAppStore } from '../../store/useAppStore'
import type { ProgressSnapshot } from '../../hooks/useProgressData'
import { SparklesGlyph } from '../mode/glyphs'
import { plural, plReviews } from '../../utils/plural'
import { EASE_OUT_EXPO } from './motion'
import './SessionHero.css'

interface Props {
  snapshot: ProgressSnapshot | null
  onStart: () => void
  secondsStudied: number
  goalSec: number
  onEditGoal: () => void
}

/**
 * Dzisiaj's one hero: the daily goal as an Activity-style ring, the session
 * pitch beside it, and the only filled button on the page.
 *
 * The ring used to be a 44px chip in the corner — the most legible "how's today
 * going" object on the screen, shrunk to a badge. It leads now, and stays the
 * tap target for changing the goal.
 *
 * Not a <button> any more: the card held two other controls (the ring, and an
 * info icon), and a button inside a button is invalid HTML that WebKit handles
 * inconsistently. The card is a plain surface that still starts the session on
 * tap; "Zaczynamy" is the real, keyboard-reachable button. The explanation of
 * the mode moved to the page's single info sheet.
 */
export function SessionHero({ snapshot, onStart, secondsStudied, goalSec, onEditGoal }: Props) {
  const reduced = useReducedMotion()
  const comfortLevel = useAppStore(s => s.comfortLevel)
  const todayLevel = useAppStore(s => s.todayLevel)
  const dailyGoalSec = useAppStore(s => s.dailyGoalSec)
  const reviewHealth = useAppStore(s => s.reviewHealth)

  const mins = Math.floor(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)
  const fraction = goalSec > 0 ? Math.min(1, secondsStudied / goalSec) : 0
  const met = fraction >= 1

  // One small bump when the goal closes while the page is open — not on every
  // visit to a page where it was already closed.
  const [bump, setBump] = useState(false)
  const wasMet = useRef(met)
  useEffect(() => {
    if (met && !wasMet.current && !reduced) setBump(true)
    wasMet.current = met
  }, [met, reduced])

  // Same `secondsStudied` the ring above is drawn from, so the pitch and the
  // ring describe one day: once the ring is part-filled the session shrinks to
  // what's left of the goal instead of re-offering the whole thing.
  const peek = snapshot
    ? smartPeek({
        snapshot, comfortLevel, todayLevel, goalSec: dailyGoalSec,
        secondsStudiedToday: secondsStudied, reviewHealth,
      })
    : null
  const hasMix = peek != null && (peek.learn > 0 || peek.review > 0 || peek.stretch > 0)

  // What the session holds, not how long it takes — the ring beside this line
  // already says the minutes ("0 z 15 min"), and repeating them as "ok. 15 min"
  // was the same number twice. Stretch words (a level up) are new words too.
  const newWords = peek ? peek.learn + peek.stretch : 0
  const mix = peek
    ? [
        newWords > 0 && `${newWords} ${plural(newWords, 'nowe słowo', 'nowe słowa', 'nowych słów')}`,
        peek.review > 0 && `${peek.review} ${plReviews(peek.review)}`,
      ].filter(Boolean).join(' · ')
    : ''

  // Only when the mix actually moved — a line explaining a decision that wasn't
  // made reads as noise. Shared with the Inteligentny session's own curtain, so
  // the two screens can't describe one decision differently.
  const reason = peek ? smartReason(peek) : null

  return (
    <div
      className={`sessionhero u-liquid u-liquid--pressable ${met ? 'u-liquid--gold sessionhero--met' : 'u-liquid--tint'}`}
      onClick={onStart}
    >
      <div className="sessionhero__top">
        <motion.button
          type="button"
          className="sessionhero__ring"
          onClick={e => { e.stopPropagation(); onEditGoal() }}
          aria-label={`Cel dnia: ${mins} z ${goalMins} min. Dotknij, aby zmienić.`}
          animate={bump ? { scale: [1, 1.04, 1] } : undefined}
          transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
          onAnimationComplete={() => setBump(false)}
        >
          <svg viewBox="0 0 88 88" className="sessionhero__ring-svg" aria-hidden="true">
            <circle cx="44" cy="44" r="38" className="sessionhero__ring-track" />
            {fraction > 0 && (
              <motion.circle
                cx="44"
                cy="44"
                r="38"
                className="sessionhero__ring-fill"
                initial={{ pathLength: reduced ? fraction : 0 }}
                animate={{ pathLength: fraction }}
                transition={{ duration: reduced ? 0 : 0.9, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
              />
            )}
          </svg>
          {/* "0/60" over "min", not "0" over "z 60 min". The ring's clear inner
              width is ~66px (88 minus the 10px stroke either side) and narrower
              still off-centre, where the second line sits; eight nowrap
              characters ran onto the stroke at every two-digit goal. The unit
              moves to its own line, which is both narrower and the way a goal
              ring is normally read. The full sentence lives in aria-label. */}
          <span className="sessionhero__ring-label" aria-hidden="true">
            <span className={`sessionhero__ring-num${mins >= 100 ? ' sessionhero__ring-num--long' : ''}`}>
              <FlowNumber value={mins} delayMs={100} />
              <span className="sessionhero__ring-goal">/{goalMins}</span>
            </span>
            <span className="sessionhero__ring-of">min</span>
          </span>
        </motion.button>

        <div className="sessionhero__copy">
          <span className="u-kicker sessionhero__kicker">
            <SparklesGlyph size={14} weight={2} /> Twoja sesja na dziś
          </span>
          <h2 className="sessionhero__title">Ucz się inteligentnie</h2>
          <p className="sessionhero__stat">
            {hasMix ? mix : 'Dobiorę słowa i powtórki do tego, jak Ci dziś idzie.'}
          </p>
        </div>
      </div>

      {reason && <p className="sessionhero__reason">{reason}</p>}

      <button
        type="button"
        className="sessionhero__cta u-cta fx-rim"
        onClick={e => { e.stopPropagation(); onStart() }}
      >
        Zaczynamy
      </button>
    </div>
  )
}
