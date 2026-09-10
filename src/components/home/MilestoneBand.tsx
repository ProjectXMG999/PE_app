import { Milestone } from '../../utils/packMilestones'
import { LEVEL_COLORS } from '../../utils/packVisuals'
import './MilestoneBand.css'

interface Props {
  milestone: Milestone
  /** Words the user actually knows — decides passed vs. ahead. */
  knownWords: number
  /** ISO date the matching level badge was earned, when known. */
  reachedAt?: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A landmark dropped into the pack list.
 *
 * Ticks are hairlines — rhythm, not information. Stations are the real moment:
 * they carry the level's name and its promise ("Dogadasz się w podróży"), and
 * once passed they carry the date, which turns the list into a personal
 * timeline rather than a catalogue.
 */
export function MilestoneBand({ milestone, knownWords, reachedAt }: Props) {
  const passed = knownWords >= milestone.words

  if (milestone.kind === 'tick') {
    return (
      <div className={`mstone-tick${passed ? ' is-passed' : ''}`} aria-hidden="true">
        <span className="mstone-tick__label">
          {milestone.words.toLocaleString('pl-PL')}
          {passed && ' ✓'}
        </span>
      </div>
    )
  }

  const level = milestone.level!
  return (
    <div
      className={`mstone${passed ? ' is-passed' : ''}`}
      style={{ ['--station' as string]: LEVEL_COLORS[level.level] ?? 'var(--accent)' }}
    >
      <div className="mstone__rule" aria-hidden="true" />
      <div className="mstone__body">
        <p className="mstone__words">
          {milestone.words.toLocaleString('pl-PL')} <span>słów</span>
        </p>
        <h3 className="mstone__name">{level.name}</h3>
        <p className="mstone__promise">{level.promise}</p>
        <p className="mstone__state">
          {passed
            ? `✓ zdobyte${reachedAt ? ` · ${formatDate(reachedAt)}` : ''}`
            : `jeszcze ${(milestone.words - knownWords).toLocaleString('pl-PL')}`}
        </p>
      </div>
      <div className="mstone__rule" aria-hidden="true" />
    </div>
  )
}
