import { useNavigate } from 'react-router-dom'
import { useProgressPulse } from '../../hooks/useProgressPulse'
import { useAppStore } from '../../store/useAppStore'
import { formatPoints } from '../../services/points'
import './ProgressPill.css'

/**
 * Streak, points and freeze, on every screen.
 *
 * "Progress shouldn't be something you feel once every six months — you should
 * see it all the time." A number that only exists on the stats tab is a number
 * most people meet once a week; here it's part of the furniture.
 *
 * This used to be one merged pill; it's now the same three separate stat
 * buttons that used to sit in a footer at the bottom of Dzisiaj, moved here
 * so they're visible everywhere instead of only on that one page.
 *
 * Sits in the top bar, which the shell only renders below 1024px — the desktop
 * equivalent is SidebarPulse.
 */
export function ProgressPill() {
  const pulse = useProgressPulse()
  const freeze = useAppStore(s => s.streakFreeze)
  const navigate = useNavigate()

  // Loading only — not "nothing to show yet". A zero-streak, zero-point pill
  // used to hide itself entirely, which meant a brand-new install (or a phone
  // that had never been seeded with fake data) showed no widget at all. That
  // directly broke "visible on every screen" for exactly the users who most
  // need the nudge to start.
  if (pulse == null) return null

  return (
    <div className="progresspill">
      <button className="progresspill__stat progresspill__stat--flame" onClick={() => navigate('/postęp')}>
        <span className="progresspill__icon" aria-hidden="true">🔥</span> {pulse.streak} dni
      </button>
      <button className="progresspill__stat progresspill__stat--points" onClick={() => navigate('/postęp')}>
        <span className="progresspill__icon" aria-hidden="true">⬥</span> {formatPoints(pulse.points)}
      </button>
      {freeze.available > 0 && (
        <span className="progresspill__stat progresspill__stat--freeze" title="Zamrożenie serii — zużyje się samo, gdy opuścisz dzień">
          <span className="progresspill__icon" aria-hidden="true">❄</span> {freeze.available}
        </span>
      )}
    </div>
  )
}
