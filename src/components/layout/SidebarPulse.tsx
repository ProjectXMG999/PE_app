import { Link } from 'react-router-dom'
import { useLinkTransition } from '../../navigation/transitions'
import { useProgressPulse } from '../../hooks/useProgressPulse'
import { formatPoints } from '../../services/points'
import { FlameGlyph, GemGlyph } from '../mode/glyphs'
import { ROUTE_TOTAL } from '../../data/levels'
import './SidebarPulse.css'

const WEEKDAY_INITIALS = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N']

/** Groups from the first thousand, unlike pl-PL's default. Built once. */
const grouped = new Intl.NumberFormat('pl-PL', { useGrouping: true })

/**
 * The desktop counterpart to ProgressPill, filling the empty space between the
 * sidebar nav and its footer. There's room here for the fuller picture: the
 * streak, the points, today's goal ring and how far along the route you are.
 */
export function SidebarPulse() {
  const pulse = useProgressPulse()
  const onLink = useLinkTransition()

  if (pulse == null) return null

  const routePct = Math.min(100, (pulse.knownWords / ROUTE_TOTAL) * 100)
  // Monday-first, matching the heatmap and Polish convention.
  const todayIndex = (new Date().getDay() + 6) % 7

  return (
    <Link to="/postęp" className="sidebarpulse" onClick={onLink('/postęp', 'lateral')}>
      <div className="sidebarpulse__row">
        <span className="sidebarpulse__streak">
          <FlameGlyph size={13} weight={2} />
          <strong>{pulse.streak}</strong>
          <span className="sidebarpulse__unit">dni</span>
        </span>
        <span className="sidebarpulse__points">
          <GemGlyph size={12} weight={2} />
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
        {/* Same pair, same rule as the compass: pl-PL groups only from five
            digits, so a plain toLocaleString wrote "2437 / 10 000". */}
        <span className="sidebarpulse__route-text">
          {grouped.format(pulse.knownWords)} / {grouped.format(ROUTE_TOTAL)}
        </span>
      </div>

      {pulse.servingLeft > 0 && (
        <span className="sidebarpulse__due">
          🔁 {pulse.servingLeft} na dziś
          {pulse.dueCount > pulse.servingLeft && ` · ${pulse.dueCount - pulse.servingLeft} w kolejce`}
        </span>
      )}
    </Link>
  )
}
