import './StatCard.css'

interface Props {
  value: number | string | null
  label: string
  icon?: string
  color?: string
  unit?: string
  small?: boolean
}

export function StatCard({ value, label, icon, color = 'var(--accent)', unit, small }: Props) {
  return (
    <div className={`statcard${small ? ' statcard--small' : ''}`}>
      <div className="statcard__value" style={{ color }}>
        {value ?? '—'}
        {icon && <span className="statcard__icon">{icon}</span>}
      </div>
      <div className="statcard__label">{label}</div>
      {unit && <div className="statcard__unit">{unit}</div>}
    </div>
  )
}
