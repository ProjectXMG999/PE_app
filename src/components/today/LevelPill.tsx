import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import './LevelPill.css'

interface Props {
  level: number | null
  onPress: () => void
}

/**
 * The level you're studying at, in that level's own colour.
 *
 * The "no level picked yet" pulse is `.fx-breathe` from animations.css, not a
 * framer keyframe array: the old version animated `boxShadow` through
 * `['0 0 0 0 transparent', '0 0 0 6px var(--accent-glow)', …]`, and framer
 * can't interpolate a CSS variable inside a shadow string — so the "gentle"
 * pulse was actually snapping between two values.
 */
export function LevelPill({ level, onPress }: Props) {
  const meta = level != null ? LEVEL_META.find(l => l.level === level) : undefined
  const color = level != null ? LEVEL_COLORS[level] : undefined

  return (
    <motion.button
      className={`levelpill${level == null ? ' levelpill--empty fx-breathe' : ''}`}
      style={color ? ({ ['--lvl' as string]: color } as CSSProperties) : undefined}
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
    >
      <span className="levelpill__dot" aria-hidden="true" />
      {meta ? meta.name : 'Wybierz poziom'}
    </motion.button>
  )
}
