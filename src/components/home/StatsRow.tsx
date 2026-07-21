import { useEffect, useState } from 'react'
import { getStreak, getTotalKnownWords, getAllSessions } from '../../services/db'
import './StatsRow.css'

const LEVEL_THRESHOLDS = [
  { level: 1, words: 1000 },
  { level: 2, words: 3000 },
  { level: 3, words: 6000 },
  { level: 4, words: 10000 },
]

export function StatsRow() {
  const [streak, setStreak] = useState(0)
  const [known, setKnown] = useState(0)
  const [avg, setAvg] = useState<number | null>(null)
  const [daysTo, setDaysTo] = useState<{ days: number | null; level: number | null }>({ days: null, level: null })

  useEffect(() => {
    Promise.all([getStreak(), getTotalKnownWords(), getAllSessions()]).then(([s, kw, sessions]) => {
      setStreak(s)
      setKnown(kw)

      const avgPerDay = sessions.length > 0
        ? (() => {
            const first = sessions[sessions.length - 1]
            const last = sessions[0]
            const elapsed = Math.max(1, Math.floor(
              (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000
            ) + 1)
            return Math.round(kw / elapsed)
          })()
        : 0

      setAvg(avgPerDay)

      const next = LEVEL_THRESHOLDS.find(t => t.words > kw)
      if (next) {
        const days = avgPerDay > 0 ? Math.ceil((next.words - kw) / avgPerDay) : null
        setDaysTo({ days, level: next.level })
      }
    })
  }, [])

  return (
    <div className="statsrow">
      <div className="statsrow__chip">
        <span className="statsrow__value">{streak}</span>
        <div className="statsrow__right">
          <span className="statsrow__label">dni z rzędu</span>
          <div className="statsrow__dots">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={`statsrow__dot ${i < streak ? 'statsrow__dot--filled' : ''}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="statsrow__chip">
        <span className="statsrow__value">{known}</span>
        <span className="statsrow__label statsrow__label--solo">słów poznanych</span>
      </div>

      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">{avg ?? '—'}</span>
        <span className="statsrow__label statsrow__label--solo">słów / dzień</span>
      </div>
      <div className="statsrow__chip statsrow__chip--sm">
        <span className="statsrow__value statsrow__value--sm">
          {daysTo.days ?? (daysTo.level ? '—' : '✓')}
        </span>
        <span className="statsrow__label statsrow__label--solo">
          {daysTo.level ? `dni do Level ${daysTo.level}` : 'maks. poziom'}
        </span>
      </div>
    </div>
  )
}
