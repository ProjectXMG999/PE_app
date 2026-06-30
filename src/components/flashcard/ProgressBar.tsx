import './ProgressBar.css'

interface Props {
  current: number
  total: number
  knownCount?: number
}

export function ProgressBar({ current, total, knownCount }: Props) {
  if (total <= 0) return <div className="progressbar" />

  const heardPct = Math.min((current / total) * 100, 100)
  const knownPct = knownCount != null ? Math.min((knownCount / total) * 100, 100) : 0

  return (
    <div className="progressbar" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      <div className="progressbar__track">
        {/* Known (green) — sits at the left, always ≤ heard */}
        <div className="progressbar__fill progressbar__fill--known" style={{ width: `${knownPct}%` }} />
        {/* Heard (orange) — extends from known to current position */}
        <div
          className="progressbar__fill progressbar__fill--heard"
          style={{ width: `${Math.max(heardPct - knownPct, 0)}%` }}
        />
      </div>
    </div>
  )
}
