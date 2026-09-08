import { useCountUp } from '../../hooks/useCountUp'
import './SectionHeader.css'

interface Props {
  label: string
  count?: number
}

export function SectionHeader({ label, count }: Props) {
  const shown = useCountUp(count ?? 0, 700, 80)
  return (
    <div className="sectionheader">
      <span className="sectionheader__label">{label}</span>
      {count !== undefined && (
        <span key={count} className="sectionheader__count">· {shown.toLocaleString('pl-PL')}</span>
      )}
    </div>
  )
}
