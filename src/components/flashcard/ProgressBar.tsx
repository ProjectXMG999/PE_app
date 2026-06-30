import './ProgressBar.css'

interface Props {
  current: number
  total: number
}

export function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="progressbar">
      <div className="progressbar__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
