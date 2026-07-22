import { useProgressData, avgWordsPerDay } from '../../hooks/useProgressData'
import { nextLevelFromTotalKnown } from '../../data/levels'
import './StatsRow.css'

export function StatsRow() {
  const snapshot = useProgressData()

  if (!snapshot) {
    return (
      <div className="statsrow">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="statsrow__chip statsrow__chip--skeleton skeleton" />
        ))}
      </div>
    )
  }

  const { streak, knownTotal } = snapshot
  const avg = avgWordsPerDay(snapshot)
  const next = nextLevelFromTotalKnown(knownTotal)
  const daysTo = next ? (avg > 0 ? Math.ceil(next.wordsToNext / avg) : null) : null

  return (
    <div className="statsrow">
      <div className={`statsrow__chip${streak > 0 ? ' statsrow__chip--streak-active' : ''}`}>
        <span className="statsrow__value">{streak}</span>
        <span className="statsrow__label--solo">dni z rzędu</span>
        <div className="statsrow__dots">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`statsrow__dot ${i < streak ? 'statsrow__dot--filled' : ''}`} />
          ))}
        </div>
      </div>
      <div className="statsrow__chip">
        <span className="statsrow__value">{knownTotal}</span>
        <span className="statsrow__label--solo">słów poznanych</span>
      </div>
      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">{avg || '—'}</span>
        <span className="statsrow__label--solo">słów / dzień</span>
      </div>
      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">
          {daysTo ?? (next ? '—' : '✓')}
        </span>
        <span className="statsrow__label--solo">
          {next ? `dni do Level ${next.level}` : 'maks.'}
        </span>
      </div>
    </div>
  )
}
