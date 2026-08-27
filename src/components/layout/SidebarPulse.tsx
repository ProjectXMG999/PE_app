import { Link } from 'react-router-dom'
import { useProgressPulse } from '../../hooks/useProgressPulse'
import { formatPoints } from '../../services/points'
import { ROUTE_TOTAL } from '../../data/levels'
import './SidebarPulse.css'

const WEEKDAY_INITIALS = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N']

/**
 * The desktop counterpart to ProgressPill, filling the empty space between the
 * sidebar nav and its footer. There's room here for the fuller picture: the
 * streak, the points, today's goal ring and how far along the route you are.
 */
export function SidebarPulse() {
  const pulse = useProgressPulse()

  if (pulse == null) return null

  const routePct = Math.min(100, (pulse.knownWords / ROUTE_TOTAL) * 100)
  // Monday-first, matching the heatmap and Polish convention.
  const todayIndex = (new Date().getDay() + 6) % 7

  return (
    <Link to="/postęp" className="sidebarpulse" viewTransition>
      <div className="sidebarpulse__row">
        <span className="sidebarpulse__streak">
          <span aria-hidden="true">🔥</span>
          <strong>{pulse.streak}</strong>
          <span className="sidebarpulse__unit">dni</span>
        </span>
        <span className="sidebarpulse__points">
          <span aria-hidden="true">⬥</span>
          <strong>{formatPoints(pulse.points)}</strong>
        </span>
      </div>

      <div className="sidebarpulse__week" aria-hidden="true">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span
            key={i}
            className={`sidebarpulse__day${i === todayIndex ? ' sidebarpulse__day--today' : ''}`}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="sidebarpulse__goal">
        <div className="sidebarpulse__goal-bar">
          <div
            className={`sidebarpulse__goal-fill${pulse.goalMet ? ' sidebarpulse__goal-fill--met' : ''}`}
            style={{ width: `${pulse.goalPct}%` }}
          />
        </div>
        <span className="sidebarpulse__goal-text">
          {pulse.goalMet
            ? 'Cel dnia zrobiony'
            : `${Math.round(pulse.secondsToday / 60)} / ${Math.round(pulse.goalSec / 60)} min`}
        </span>
      </div>

      <div className="sidebarpulse__route">
        <div className="sidebarpulse__route-bar">
          <div className="sidebarpulse__route-fill" style={{ width: `${routePct}%` }} />
        </div>
        <span className="sidebarpulse__route-text">
          {pulse.knownWords.toLocaleString('pl-PL')} / {ROUTE_TOTAL.toLocaleString('pl-PL')}
        </span>
      </div>

      {pulse.dueCount > 0 && (
        <span className="sidebarpulse__due">
          🔁 {pulse.dueCount} do powtórki
        </span>
      )}
    </Link>
  )
}
