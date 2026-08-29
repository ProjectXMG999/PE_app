import { motion, useReducedMotion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import { EASE_OUT_EXPO } from './motion'
import './DailyTimeRing.css'

interface Props {
  secondsStudied: number
  goalSec: number
  onEditGoal?: () => void
}

/**
 * The daily-goal gauge — a bold gradient figure over a slim progress bar,
 * not a donut. A ring reads as "one more chart"; a big number you can read
 * from across the room plus a thin fill bar is the pattern most current
 * habit-tracking apps converged on, and it's also flatter (no fixed square
 * footprint to balance against the text column next to it).
 */
export function DailyTimeRing({ secondsStudied, goalSec, onEditGoal }: Props) {
  const reduced = useReducedMotion()
  const mins = Math.floor(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)
  const pct = goalSec > 0 ? Math.min(100, Math.round((secondsStudied / goalSec) * 100)) : 0
  const met = pct >= 100
  const left = Math.max(0, goalMins - mins)

  // The figure rolls up from 0 in step with the fill bar below it (both 1.5s,
  // after a short hold). Status text stays on the true `mins` so it doesn't
  // flicker mid-roll.
  const shownMins = useCountUp(mins, 1500, 150)

  const className = `timering${met ? ' timering--met' : ''}${onEditGoal ? ' timering--tappable' : ''}`
  const statusClass = `timering__status${met ? ' timering__status--met' : ''}`

  const body = (
    <>
      <p className="timering__eyebrow">Cel dnia</p>

      <div className="timering__figure">
        <span key={mins} className="timering__value">{shownMins}</span>
        <span className="timering__unit">min</span>
        <span className="timering__of">/ {goalMins} min</span>
        <span key={met ? 'met' : 'todo'} className={statusClass}>
          {met ? '✓ zrobione' : mins === 0 ? 'start dnia' : `jeszcze ${left} min`}
        </span>
      </div>

      <div
        className="timering__track"
        role="img"
        aria-label={`${mins} z ${goalMins} minut, ${pct} procent celu`}
      >
        <motion.div
          className="timering__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 1.5, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
        >
          <span className="timering__shine" aria-hidden="true" />
          {met && <span className="timering__met-sweep" aria-hidden="true" />}
        </motion.div>
      </div>
    </>
  )

  if (onEditGoal) {
    return (
      <button
        type="button"
        className={className}
        onClick={onEditGoal}
        aria-label={`Cel dnia: ${mins} z ${goalMins} min. Dotknij, aby zmienić.`}
      >
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}
