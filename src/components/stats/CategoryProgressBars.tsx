import { PackMeta } from '../../types/vocabulary'
import { knownByCategory } from '../../data/categories'
import './CategoryProgressBars.css'

interface Props {
  allPacks: PackMeta[]
  knownMap: Map<string, number>
}

export function CategoryProgressBars({ allPacks, knownMap }: Props) {
  const rows = knownByCategory(allPacks, knownMap)

  return (
    <div className="category-progress">
      {rows.map(({ category, total, known, pct }) => (
        <div key={category} className="category-progress__row">
          <span className="category-progress__label">{category}</span>
          <div className="category-progress__bar">
            <div
              className="category-progress__fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="category-progress__count">{known} / {total}</span>
        </div>
      ))}
    </div>
  )
}
