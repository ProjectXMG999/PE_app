import './ProgressBar.css'

interface Props {
  current: number
  total: number
  knownCount?: number
}

export function ProgressBar({ current, total, knownCount }: Props) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0
  const knownPct = total > 0 && knownCount != null ? Math.min((knownCount / total) * 100, 100) : null

  return (
    <div className="progressbar">
      <div className="progressbar__track progressbar__track--heard">
        <div className="progressbar__fill progressbar__fill--heard" style={{ width: `${pct}%` }} />
      </div>
      {knownPct !== null && (
        <div className="progressbar__track progressbar__track--known">
          <div className="progressbar__fill progressbar__fill--known" style={{ width: `${knownPct}%` }} />
        </div>
      )}
    </div>
  )
}
