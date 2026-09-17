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
 * No pulse when nothing is picked — the "Wybierz poziom" label already asks,
 * and a glow breathing forever at the top of the page was motion that meant
 * nothing after the first second.
 */
export function LevelPill({ level, onPress }: Props) {
  const meta = level != null ? LEVEL_META.find(l => l.level === level) : undefined
  const color = level != null ? LEVEL_COLORS[level] : undefined

  return (
    <motion.button
      className={`levelpill u-liquid${level == null ? ' levelpill--empty' : ''}`}
      style={color ? ({ ['--lvl' as string]: color } as CSSProperties) : undefined}
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
    >
      <span className="levelpill__dot" aria-hidden="true" />
      {meta ? meta.name : 'Wybierz poziom'}
    </motion.button>
  )
}
