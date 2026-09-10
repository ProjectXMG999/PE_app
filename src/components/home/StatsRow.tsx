import { useProgressData, avgWordsPerDay } from '../../hooks/useProgressData'
import { nextLevelFromTotalKnown } from '../../data/levels'
import { useCountUp } from '../../hooks/useCountUp'
import './StatsRow.css'

export function StatsRow() {
  const snapshot = useProgressData()

  const streak = snapshot?.streak ?? 0
  const knownTotal = snapshot?.knownTotal ?? 0
  const avg = snapshot ? avgWordsPerDay(snapshot) : 0
  const next = nextLevelFromTotalKnown(knownTotal)
  const daysTo = next ? (avg > 0 ? Math.ceil(next.wordsToNext / avg) : null) : null

  // Hooks run unconditionally; targets are 0 when the stat isn't shown as a number.
  const shownStreak = useCountUp(streak, 900, 120)
  const shownKnown = useCountUp(knownTotal, 1100, 160)
  const shownAvg = useCountUp(avg, 900, 200)
  const shownDays = useCountUp(daysTo ?? 0, 900, 240)

  if (!snapshot) {
    return (
      <div className="statsrow">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="statsrow__chip statsrow__chip--skeleton skeleton" />
        ))}
      </div>
    )
  }

  return (
    <div className="statsrow">
      <div className={`statsrow__chip${streak > 0 ? ' statsrow__chip--streak-active' : ''}`}>
        <span className="statsrow__value">{shownStreak}</span>
        <span className="statsrow__label--solo">dni z rzędu</span>
        <div className="statsrow__dots">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`statsrow__dot ${i < streak ? 'statsrow__dot--filled' : ''}`}
              style={{ transitionDelay: `${i * 55}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="statsrow__chip">
        <span className="statsrow__value">{shownKnown.toLocaleString('pl-PL')}</span>
        <span className="statsrow__label--solo">słów poznanych</span>
      </div>
      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">{avg > 0 ? shownAvg : '—'}</span>
        <span className="statsrow__label--solo">słów / dzień</span>
      </div>
      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">
          {daysTo != null ? shownDays : (next ? '—' : '✓')}
        </span>
        <span className="statsrow__label--solo">
          {next ? `dni do ${next.level === 'MASTER' ? 'MASTER' : `Level ${next.level}`}` : 'MASTER'}
        </span>
      </div>
    </div>
  )
}
