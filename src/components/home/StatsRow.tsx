import { useEffect, useState } from 'react'
import { getStreak, getTotalKnownWords } from '../../services/db'
import './StatsRow.css'

export function StatsRow() {
  const [streak, setStreak] = useState(0)
  const [known, setKnown] = useState(0)

  useEffect(() => {
    Promise.all([getStreak(), getTotalKnownWords()]).then(([s, k]) => {
      setStreak(s)
      setKnown(k)
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
    </div>
  )
}
