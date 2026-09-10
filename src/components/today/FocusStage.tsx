import { useCountUp } from '../../hooks/useCountUp'
import './FocusStage.css'

interface Props {
  secondsStudied: number
  goalSec: number
  onEditGoal: () => void
}

/**
 * Compact daily-goal readout: a small conic ring carries the progress, the
 * figure sits inside it, one line of status beside it. Tap to change the goal.
 * Deliberately small — it's a glance, not the screen.
 */
export function FocusStage({ secondsStudied, goalSec, onEditGoal }: Props) {
  const mins = Math.floor(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)
  const pct = goalSec > 0 ? Math.min(100, Math.round((secondsStudied / goalSec) * 100)) : 0
  const met = pct >= 100
  const left = Math.max(0, goalMins - mins)
  const shownMins = useCountUp(mins, 1000, 100)

  return (
    <button
      type="button"
      className={`focusstage u-surface${met ? ' focusstage--met' : ''}`}
      onClick={onEditGoal}
      aria-label={`Cel dnia: ${mins} z ${goalMins} minut, ${pct}%. Dotknij, aby zmienić.`}
    >
      <span className="focusstage__ring" aria-hidden="true" style={{ ['--focus-fill' as string]: pct }}>
        <span className="focusstage__core fx-pop" key={mins}>{shownMins}</span>
      </span>

      <span className="focusstage__meta">
        <span className="u-kicker">Cel dnia</span>
        <strong>{mins} <small>/ {goalMins} min</small></strong>
        <span className="focusstage__status">
          {met ? '✓ zrobione' : mins === 0 ? 'zacznij dziś' : `jeszcze ${left} min`}
        </span>
      </span>

      <span className="focusstage__edit" aria-hidden="true">Zmień</span>
    </button>
  )
}
