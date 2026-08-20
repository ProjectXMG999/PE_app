import { TimeOfDayStats } from '../../services/db'
import './TimeOfDayChart.css'

const BAND_ICON: Record<string, string> = {
  'rano': '🌅',
  'popołudnie': '☀️',
  'wieczór': '🌆',
  'noc': '🌙',
}

interface Props {
  data: TimeOfDayStats[]
}

export function TimeOfDayChart({ data }: Props) {
  return (
    <div className="tod-chart">
      {data.map(({ band, effectivenessPct }) => (
        <div key={band} className="tod-chart__row">
          <span className="tod-chart__label">
            <span className="tod-chart__icon">{BAND_ICON[band]}</span>
            {band}
          </span>
          <div className="tod-chart__bar">
            <div className="tod-chart__fill" style={{ width: `${effectivenessPct}%` }} />
          </div>
          <span className="tod-chart__pct">{effectivenessPct}%</span>
        </div>
      ))}
    </div>
  )
}
