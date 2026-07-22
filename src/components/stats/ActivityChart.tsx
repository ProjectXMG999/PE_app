import { DayActivity } from '../../types/progress'
import './ActivityChart.css'

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']

interface Props {
  data: DayActivity[]
}

function formatLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return DAY_LABELS[d.getDay()]
}

export function ActivityChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  const today = new Date().toISOString().split('T')[0]
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div
      className="activity-chart"
      role="img"
      aria-label={`Aktywność z ostatnich 7 dni: ${total} słów`}
    >
      <div className="activity-chart__bars">
        {data.map((d, i) => {
          const isToday = d.date === today
          const heightPct = d.count > 0 ? Math.max(6, (d.count / max) * 100) : 0
          return (
            <div key={d.date} className="activity-chart__col" title={`${d.count} słów`}>
              <span className={`activity-chart__count${d.count > 0 ? '' : ' activity-chart__count--zero'}`}>
                {d.count > 0 ? d.count : ''}
              </span>
              <div className="activity-chart__track">
                <div
                  className={`activity-chart__bar${isToday ? ' activity-chart__bar--today' : ''}`}
                  style={{ height: `${heightPct}%`, animationDelay: `${i * 40}ms` }}
                />
              </div>
              <span className={`activity-chart__label${isToday ? ' activity-chart__label--today' : ''}`}>
                {formatLabel(d.date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
