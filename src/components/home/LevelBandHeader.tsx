import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import './LevelBandHeader.css'

interface Props {
  level: number
}

/**
 * A sticky band label dropped into the pack list between level groups (only
 * when no level filter is active), so a long scroll of otherwise-uniform cards
 * gets rhythm and a sense of "where am I".
 */
export function LevelBandHeader({ level }: Props) {
  const meta = LEVEL_META.find(l => l.level === level)
  return (
    <div
      className="homepage__band"
      style={{ ['--band' as string]: LEVEL_COLORS[level] ?? 'var(--text-muted)' }}
    >
      <span className="homepage__band-dot" aria-hidden="true" />
      <span className="homepage__band-level">Level {level}</span>
      {meta && <span className="homepage__band-name">{meta.name}</span>}
    </div>
  )
}
