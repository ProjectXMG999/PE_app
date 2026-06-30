import './StatCard.css'

interface Props {
  value: number | string
  label: string
  icon?: string
  color?: string
}

export function StatCard({ value, label, icon, color = 'var(--accent)' }: Props) {
  return (
    <div className="statcard">
      <div className="statcard__value" style={{ color }}>
        {value}
        {icon && <span className="statcard__icon">{icon}</span>}
      </div>
      <div className="statcard__label">{label}</div>
    </div>
  )
}
