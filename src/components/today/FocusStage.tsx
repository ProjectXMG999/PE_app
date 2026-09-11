import { useCountUp } from '../../hooks/useCountUp'
import './FocusStage.css'

interface Props {
  secondsStudied: number
  goalSec: number
  onEditGoal: () => void
}

/**
 * The daily goal, as one object: a ring carrying the progress with the figure
 * inside it, the one line that matters beside it, and the arithmetic under
 * that. Tap to change the goal.
 *
 * The status line is the headline, not the fraction — "jeszcze 8 min" is what
 * you act on; "12 / 20" is the evidence for it. The ring already holds the
 * minutes done, so the line under it only carries what the ring can't.
 */
export function FocusStage({ secondsStudied, goalSec, onEditGoal }: Props) {
  const mins = Math.floor(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)
  const pct = goalSec > 0 ? Math.min(100, Math.round((secondsStudied / goalSec) * 100)) : 0
  const met = pct >= 100
  const left = Math.max(0, goalMins - mins)
  const shownMins = useCountUp(mins, 1000, 100)

  const headline = met
    ? 'Cel osiągnięty'
    : mins === 0
      ? 'Zacznij dziś'
      : `Jeszcze ${left} min`

  return (
    <button
      type="button"
      className={`focusstage u-surface--raised${met ? ' focusstage--met' : ''}`}
      onClick={onEditGoal}
      aria-label={`Cel dnia: ${mins} z ${goalMins} minut, ${pct}%. Dotknij, aby zmienić.`}
    >
      <span className="focusstage__ring" aria-hidden="true" style={{ ['--focus-fill' as string]: pct }}>
        <span className="focusstage__core">
          <span className="focusstage__num fx-pop" key={mins}>{shownMins}</span>
          <span className="focusstage__unit">min</span>
        </span>
      </span>

      <span className="focusstage__meta">
        <span className="focusstage__kicker u-kicker">Cel dnia</span>
        <strong className="focusstage__headline">{headline}</strong>
        <span className="focusstage__sub">
          z {goalMins} min · {pct}%
        </span>
      </span>

      <span className="focusstage__edit">
        Zmień
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </button>
  )
}
