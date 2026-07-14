import { PackMeta } from '../../types/vocabulary'
import './LevelProgressBars.css'

interface Props {
  allPacks: PackMeta[]
  knownMap: Map<string, number>
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#eab308',
  2: '#f97316',
  3: '#22c55e',
  4: '#3b82f6',
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
        <div key={lvl} className="level-progress__row">
          <span className="level-progress__label" style={{ color: LEVEL_COLORS[lvl] }}>
            Level {lvl}
          </span>
          <div className="level-progress__bar">
            <div
              className="level-progress__fill"
              style={{ width: `${pct}%`, background: LEVEL_COLORS[lvl] }}
            />
          </div>
          <span className="level-progress__count">{known} / {total}</span>
        </div>
      ))}
    </div>
  )
}
