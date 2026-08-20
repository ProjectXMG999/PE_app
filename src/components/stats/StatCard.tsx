import './StatCard.css'

interface Props {
  value: number | string | null
  label: string
  icon?: string
  color?: string
  accentColor?: string
  unit?: string
  small?: boolean
  hero?: boolean
  /** Trend badge next to the value, e.g. "↑ 18%". Sign of deltaPct picks the color. */
  trend?: { deltaPct: number }
}

export function StatCard({ value, label, icon, color = 'var(--accent)', accentColor, unit, small, hero, trend }: Props) {
  const cls = [
    'statcard',
    small ? 'statcard--small' : '',
    hero ? 'statcard--hero' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}
    >
      {icon && <span className="statcard__icon-top">{icon}</span>}
      <div className="statcard__value-row">
        <div className="statcard__value" style={{ color: hero ? '#fff' : color }}>
          {value ?? '—'}
        </div>
        {trend && (
          <span className={`statcard__trend ${trend.deltaPct >= 0 ? 'statcard__trend--up' : 'statcard__trend--down'}`}>
            {trend.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(trend.deltaPct)}%
          </span>
        )}
      </div>
      <div className={`statcard__label${hero ? ' statcard__label--hero' : ''}`}>{label}</div>
      {unit && <div className="statcard__unit">{unit}</div>}
    </div>
  )
}
