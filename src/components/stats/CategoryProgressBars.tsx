import { memo, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PackMeta } from '../../types/vocabulary'
import { knownByCategory } from '../../data/categories'
import { EASE_OUT_EXPO } from '../today/motion'
import { FlowNumber } from '../shared/FlowNumber'
import './CategoryProgressBars.css'

interface Props {
  allPacks: PackMeta[]
  knownMap: Map<string, number>
}

export const CategoryProgressBars = memo(function CategoryProgressBars({ allPacks, knownMap }: Props) {
  const reduced = useReducedMotion()
  // knownByCategory walks the catalogue once per category; both props are
  // stable per snapshot, so there is nothing to recompute between them.
  const rows = useMemo(() => knownByCategory(allPacks, knownMap), [allPacks, knownMap])

  return (
    <div className="category-progress">
      {/* Same behaviour as its sibling on the level breakdown: each bar draws
          and each count rolls as the row scrolls into view, cascading down the
          list. The stagger is capped — this list is as long as the category
          set, and a delay that kept growing would leave the last rows visibly
          waiting for their turn. */}
      {rows.map(({ category, total, known, pct }, i) => {
        const step = Math.min(i, 7) * 0.06
        return (
          <div key={category} className="category-progress__row">
            <span className="category-progress__label">{category}</span>
            <div className="category-progress__bar">
              <motion.div
                className="category-progress__fill"
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT_EXPO, delay: step }}
              />
            </div>
            <span className="category-progress__count">
              <FlowNumber value={known} onView delayMs={Math.round(step * 1000)} /> / {total}
            </span>
          </div>
        )
      })}
    </div>
  )
})
