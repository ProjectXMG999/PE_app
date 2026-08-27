import { AchievementState } from '../../services/achievements'
import './AchievementTile.css'

interface Props {
  state: AchievementState
  onClick?: (s: AchievementState) => void
  /** Shows a progress bar and "x / y" under the tile. */
  showProgress?: boolean
}

function formatValue(n: number): string {
  return n.toLocaleString('pl-PL')
}

/**
 * One badge.
 *
 * Locked badges are dimmed but never hidden, and always show their target — a
 * map that conceals the road ahead isn't a map. That also makes the locked state
 * useful rather than teasing: "37 / 100" tells you what to do next.
 */
export function AchievementTile({ state, onClick, showProgress }: Props) {
  const { achievement: a, unlocked, value, pct, isNew } = state
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={[
        'achtile',
        unlocked ? `achtile--unlocked achtile--${a.tier}` : 'achtile--locked',
        isNew ? 'achtile--new' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick ? () => onClick(state) : undefined}
      aria-label={`${a.title} — ${unlocked ? 'zdobyte' : `${formatValue(value)} z ${formatValue(a.threshold)}`}`}
    >
      {isNew && <span className="achtile__new-dot" aria-hidden="true" />}

      <span className="achtile__icon" aria-hidden="true">{a.icon}</span>
      <span className="achtile__title">{a.title}</span>

      {showProgress && !unlocked ? (
        <span className="achtile__progress">
          <span className="achtile__bar">
            <span className="achtile__bar-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="achtile__count">
            {formatValue(Math.min(value, a.threshold))} / {formatValue(a.threshold)}
            {a.unit ? ` ${a.unit}` : ''}
          </span>
        </span>
      ) : (
        <span className="achtile__threshold">
          {formatValue(a.threshold)}{a.unit ? ` ${a.unit}` : ''}
        </span>
      )}
    </Tag>
  )
}
