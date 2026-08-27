import { DayActivity } from '../../types/progress'
import { dayKey, parseDay } from '../../utils/day'
import './ActivityHeatmap.css'

interface Props {
  /** Oldest first. */
  data: DayActivity[]
  /** Local day keys saved by a streak freeze. */
  frozenDays?: string[]
}

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

/** Buckets a day's word count into one of four intensities. */
function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  const share = count / Math.max(max, 1)
  if (share > 0.75) return 4
  if (share > 0.5) return 3
  if (share > 0.25) return 2
  return 1
}

/**
 * Four weeks of study, as a calendar rather than a bar chart.
 *
 * A seven-bar week shows volume; a month grid shows *rhythm* — and rhythm is
 * what the streak is actually made of. Consecutive days are joined by a
 * connector so an unbroken run reads as one continuous line rather than as a
 * number you have to take on trust.
 */
export function ActivityHeatmap({ data, frozenDays = [] }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  const today = dayKey()
  const frozen = new Set(frozenDays)
  const total = data.reduce((s, d) => s + d.count, 0)
  const activeDays = data.filter(d => d.count > 0 || frozen.has(d.date)).length

  // Pad the start so columns line up under their weekday. getDay(): 0 = Sunday.
  const first = data.length > 0 ? parseDay(data[0].date).getDay() : 1
  const leadingBlanks = (first + 6) % 7

  return (
    <div className="heatmap">
      <div className="heatmap__weekdays" aria-hidden="true">
        {WEEKDAYS.map(d => (
          <span key={d} className="heatmap__weekday">{d}</span>
        ))}
      </div>

      <div
        className="heatmap__grid"
        role="img"
        aria-label={`Aktywność z ostatnich ${data.length} dni: ${total} słów w ${activeDays} dniach`}
      >
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} className="heatmap__cell heatmap__cell--blank" />
        ))}

        {data.map((d, i) => {
          const isFrozen = frozen.has(d.date) && d.count === 0
          const lvl = level(d.count, max)
          const prev = data[i - 1]
          // Only link within a row: the connector is a visual join, and a line
          // wrapping to the next line would read as a break anyway.
          const linked =
            prev != null &&
            (prev.count > 0 || frozen.has(prev.date)) &&
            (d.count > 0 || isFrozen) &&
            (leadingBlanks + i) % 7 !== 0

          return (
            <span
              key={d.date}
              className={[
                'heatmap__cell',
                `heatmap__cell--l${lvl}`,
                isFrozen ? 'heatmap__cell--frozen' : '',
                d.date === today ? 'heatmap__cell--today' : '',
                linked ? 'heatmap__cell--linked' : '',
              ].filter(Boolean).join(' ')}
              title={`${d.date}: ${isFrozen ? 'zamrożone' : `${d.count} słów`}`}
            >
              {isFrozen && <span className="heatmap__snow" aria-hidden="true">❄</span>}
            </span>
          )
        })}
      </div>

      <div className="heatmap__legend">
        <span className="heatmap__legend-text">{activeDays} z {data.length} dni</span>
        <span className="heatmap__legend-scale" aria-hidden="true">
          mniej
          <span className="heatmap__cell heatmap__cell--l0" />
          <span className="heatmap__cell heatmap__cell--l1" />
          <span className="heatmap__cell heatmap__cell--l2" />
          <span className="heatmap__cell heatmap__cell--l3" />
          <span className="heatmap__cell heatmap__cell--l4" />
          więcej
        </span>
      </div>
    </div>
  )
}
