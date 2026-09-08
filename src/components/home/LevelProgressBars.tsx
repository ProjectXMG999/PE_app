import { motion, useReducedMotion } from 'framer-motion'
import { PackMeta } from '../../types/vocabulary'
import { LEVEL_COLORS } from '../../data/levels'
import { EASE_OUT_EXPO } from '../today/motion'
import { useCountUp } from '../../hooks/useCountUp'
import './LevelProgressBars.css'

interface Props {
  allPacks: PackMeta[]
  knownMap: Map<string, number>
}

export function LevelProgressBars({ allPacks, knownMap }: Props) {
  const reduced = useReducedMotion()
  const rows = ([1, 2, 3, 4] as const).map(lvl => {
    const packs = allPacks.filter(p => p.level === lvl)
    const total = packs.reduce((s, p) => s + p.wordCount, 0)
    const known = packs.reduce((s, p) => s + (knownMap.get(p.id) ?? 0), 0)
    return { lvl, total, known, pct: total > 0 ? (known / total) * 100 : 0 }
  })

  return (
    <div className="level-progress">
      {rows.map(({ lvl, total, known, pct }, i) => (
        <Row key={lvl} lvl={lvl} total={total} known={known} pct={pct} index={i} reduced={!!reduced} />
      ))}
    </div>
  )
}

interface RowProps {
  lvl: 1 | 2 | 3 | 4
  total: number
  known: number
  pct: number
  index: number
  reduced: boolean
}

function Row({ lvl, total, known, pct, index, reduced }: RowProps) {
  const shownKnown = useCountUp(known, 900, 120 + index * 80)
  return (
    <div className={`level-progress__row level-progress__row--${lvl}`}>
      <span className="level-progress__label" style={{ color: LEVEL_COLORS[lvl] }}>
        Level {lvl}
      </span>
      <div className="level-progress__bar">
        <motion.div
          className="level-progress__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.12 + index * 0.08 }}
        />
      </div>
      <span className="level-progress__count">
        {shownKnown.toLocaleString('pl-PL')} / {total.toLocaleString('pl-PL')}
      </span>
    </div>
  )
}
