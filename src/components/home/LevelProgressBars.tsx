import { PackMeta } from '../../types/vocabulary'
import { LEVEL_COLORS } from '../../data/levels'
import './LevelProgressBars.css'

interface Props {
  allPacks: PackMeta[]
  knownMap: Map<string, number>
}

export function LevelProgressBars({ allPacks, knownMap }: Props) {
  const rows = ([1, 2, 3, 4] as const).map(lvl => {
    const packs = allPacks.filter(p => p.level === lvl)
    const total = packs.reduce((s, p) => s + p.wordCount, 0)
    const known = packs.reduce((s, p) => s + (knownMap.get(p.id) ?? 0), 0)
    return { lvl, total, known, pct: total > 0 ? (known / total) * 100 : 0 }
  })

  return (
    <div className="level-progress">
      {rows.map(({ lvl, total, known, pct }) => (
        <div key={lvl} className={`level-progress__row level-progress__row--${lvl}`}>
          <span className="level-progress__label" style={{ color: LEVEL_COLORS[lvl] }}>
            Level {lvl}
          </span>
          <div className="level-progress__bar">
            <div
              className="level-progress__fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="level-progress__count">{known} / {total}</span>
        </div>
      ))}
    </div>
  )
}
