import { CSSProperties, useEffect, useRef, useState } from 'react'
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
 * The ring's arc and the ring's figure are two readings of one quantity —
 * today's minutes — so they run on one clock and one curve.
 *
 * Measured rather than assumed, because the obvious guess was wrong: NumberFlow's
 * default transformTiming is already 900 ms, exactly the arc's, so the figure
 * was never settling early. What did differ was the curve (its default is a
 * `linear()` spring approximation, the arc is EASE_OUT_EXPO) and a 50 ms head
 * start. Both are small; aligning them costs one prop and removes the question.
 */
/**
 * The ring's colour ramp, in the Trening exercises' own palette — the icons
 * whose lit tiles this is borrowed from. Red on an untouched day, green once
 * the goal is closed: the reading everybody already owns, and the two ends the
 * learner is actually being asked about ("have I done today's minutes?").
 *
 * Nothing sits between them because nothing needs to. In OKLCH the short way
 * from 5° to 150° runs through orange and yellow, so the middle of the day is
 * handed to us — a third stop would only pull it off that line and read as a
 * separate state rather than as a day filling up.
 *
 * Deliberately not the violet --accent it used to be. Violet is the app's
 * chrome — it is on the kicker, the CTA, the nav, the mesh behind all of it —
 * so a violet ring is the one thing on this card that cannot stand out.
 */
const RING_RAMP = ['var(--accent-pink)', 'var(--accent-green)']

/**
 * A fraction of the daily goal → one CSS colour, mixed between the two nearest
 * stops so the ring travels the ramp smoothly rather than snapping between
 * three states.
 *
 * Built here rather than in CSS because color-mix() blends exactly two colours:
 * a three-stop ramp in pure CSS would need the piecewise choice of *which* two,
 * which is a calc() no one should have to read. The stops stay as var() names,
 * so both themes still resolve them their own way.
 */
function ringRamp(fraction: number): string {
  const f = Math.min(1, Math.max(0, fraction))
  const span = RING_RAMP.length - 1
  const i = Math.min(span - 1, Math.floor(f * span))
  const t = (f - i / span) * span
  return `color-mix(in oklch, ${RING_RAMP[i + 1]} ${(t * 100).toFixed(1)}%, ${RING_RAMP[i]})`
}

const RING_DELAY_MS = 150
const RING_DURATION_MS = 900
/** Same curve as the arc's EASE_OUT_EXPO, spelled as CSS for NumberFlow. */
const RING_TIMING: EffectTiming = {
  duration: RING_DURATION_MS,
  easing: `cubic-bezier(${EASE_OUT_EXPO.join(', ')})`,
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
      className="sessionhero u-liquid u-liquid--tint u-liquid--pressable"
      /* One colour for the whole card. This is also why the gold/violet variant
         swap is gone: at fraction 1 the ramp IS gold, so the card can no longer
         disagree with the ring sitting on it. */
      style={{ ['--ring-raw' as string]: ringRamp(fraction) } as CSSProperties}
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
                transition={{
                  duration: reduced ? 0 : RING_DURATION_MS / 1000,
                  ease: EASE_OUT_EXPO,
                  delay: reduced ? 0 : RING_DELAY_MS / 1000,
                }}
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
              <FlowNumber value={mins} delayMs={RING_DELAY_MS} timing={RING_TIMING} />
              {/* The goal rolls too, but with no arrival hold: on opening the
                  page it is context, not the reading, and a second figure
                  counting up beside the first turns one arrival into a show.
                  It animates only when it actually changes — which is the one
                  moment it IS the news, straight after the picker sets it. That
                  also stops the ring being the one place this number snaps
                  while it rolls inside the picker that just changed it. */}
              <span className="sessionhero__ring-goal">
                /<FlowNumber value={goalMins} timing={RING_TIMING} />
              </span>
            </span>
            <span className="sessionhero__ring-of">min</span>
          </span>
        </motion.button>

        <div className="sessionhero__copy">
          <span className="u-kicker sessionhero__kicker">
            <SparklesGlyph size={14} weight={2} /> Twoja sesja na dziś
          </span>
          <h2 className="sessionhero__title">Ucz się inteligentnie</h2>
          {/* Three states, not two. A peek that came back empty is a FACT —
              nothing new left on the route, nothing due — and saying "dobiorę
              słowa i powtórki" there promises a session the next screen then
              refuses with "Nic do zrobienia". The pitch only speaks in the
              future tense while the snapshot is still loading. */}
          <p className="sessionhero__stat">
            {hasMix
              ? mix
              : peek
                ? 'Wszystko opanowane — dziś nie ma nowych słów ani powtórek.'
                : 'Dobiorę słowa i powtórki do tego, jak Ci dziś idzie.'}
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
