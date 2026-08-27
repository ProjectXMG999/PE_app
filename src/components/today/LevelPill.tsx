import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import './LevelPill.css'

interface Props {
  level: number | null
  onPress: () => void
}

export function LevelPill({ level, onPress }: Props) {
  const reduced = useReducedMotion()
  const meta = level != null ? LEVEL_META.find(l => l.level === level) : undefined
  const color = level != null ? LEVEL_COLORS[level] : 'var(--text-muted)'

  return (
    <motion.button
      className="levelpill"
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
      animate={
        level == null && !reduced
          ? { boxShadow: ['0 0 0 0 transparent', '0 0 0 6px var(--accent-glow)', '0 0 0 0 transparent'] }
          : undefined
      }
      transition={level == null ? { duration: 1.8, repeat: 2, repeatDelay: 0.6 } : undefined}
    >
      <span className="levelpill__dot" style={{ background: color }} aria-hidden="true" />
      {meta ? meta.name : 'Wybierz poziom'}
    </motion.button>
  )
}
