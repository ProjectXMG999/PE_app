import { motion, useReducedMotion } from 'framer-motion'
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

  const className = `timering${met ? ' timering--met' : ''}${onEditGoal ? ' timering--tappable' : ''}`

  const body = (
    <>
      <p className="timering__eyebrow">Cel dnia</p>

      <div className="timering__figure">
        <span className="timering__value">{mins}</span>
        <span className="timering__unit">min</span>
        <span className="timering__of">/ {goalMins} min</span>
        <span className="timering__status">
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
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_EXPO }}
        >
          <span className="timering__shine" aria-hidden="true" />
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
