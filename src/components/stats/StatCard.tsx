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
}

export function StatCard({ value, label, icon, color = 'var(--accent)', accentColor, unit, small, hero }: Props) {
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
      <div className="statcard__value" style={{ color: hero ? '#fff' : color }}>
        {value ?? '—'}
      </div>
      <div className={`statcard__label${hero ? ' statcard__label--hero' : ''}`}>{label}</div>
      {unit && <div className="statcard__unit">{unit}</div>}
    </div>
  )
}
