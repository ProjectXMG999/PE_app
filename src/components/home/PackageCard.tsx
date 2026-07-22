import { useNavigate } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import {
  LEVEL_COLORS,
  getPackIcon,
  getCategoryColor,
  getPackNumber,
  getStatus,
  STATUS_META,
} from '../../utils/packVisuals'
import './PackageCard.css'

interface Props {
  pack: PackMeta
  progress?: PackageProgress
  knownCount?: number
}

export function PackageCard({ pack, progress, knownCount = 0 }: Props) {
  const navigate = useNavigate()
  const icon = getPackIcon(pack)
  const color = getCategoryColor(pack.category)
  const heardPct = progress ? Math.min((progress.currentIndex / pack.wordCount) * 100, 100) : 0
  const knownPct = pack.wordCount > 0 ? Math.min((knownCount / pack.wordCount) * 100, 100) : 0
  const status = getStatus(progress)
  const { label: statusLabel, className: statusClass } = STATUS_META[status]
  const packNum = getPackNumber(pack.id)
  // Mastered = VIP gold treatment; CSS owns all colors, so skip the inline overrides
  const isMastered = status === 'mastered'

  return (
    <div
      className={`packcard ${statusClass}`}
      onClick={() => navigate(`/pakiet/${pack.id}`)}
      style={{ cursor: 'pointer' }}
    >
      {/* Status stripe — visible left border accent (gold border replaces it when mastered) */}
      {status !== 'new' && !isMastered && <div className="packcard__stripe" />}

      <div className="packcard__header">
        {packNum && (
          <div className="packcard__num">
            <span
              className="packcard__num-text"
              style={{ color: !isMastered && pack.level ? LEVEL_COLORS[pack.level] : undefined }}
            >
              #{packNum}
            </span>
          </div>
        )}
        <div className="packcard__icon" style={isMastered ? undefined : { background: `${color}22`, color }}>
          {icon}
        </div>
        <div className="packcard__info">
          <h3 className="packcard__name">{pack.name}</h3>
          <span className="packcard__meta">{pack.category}</span>
        </div>
        <div className="packcard__right">
          {statusLabel && (
            <span className={`packcard__status-pill packcard__status-pill--${status}`}>
              {statusLabel}
            </span>
          )}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <div className="packcard__progress-row">
        <span className="packcard__count">
          {knownCount} / {pack.wordCount} opanowanych
        </span>
        {pack.level && (
          <span className="packcard__level">Level {pack.level}</span>
        )}
      </div>

      {(heardPct > 0 || knownPct > 0) && (
        <div className="packcard__bars">
          <div className="packcard__bar packcard__bar--heard">
            <div className="packcard__bar-fill" style={{ width: `${heardPct}%` }} />
          </div>
          <div className="packcard__bar packcard__bar--known">
            <div className="packcard__bar-fill" style={{ width: `${knownPct}%` }} />
          </div>
        </div>
      )}

      <div className="packcard__actions">
        <button
          className="packcard__btn packcard__btn--autoplay"
          onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/start`) }}
        >
          <span>🎧</span> Słuchaj
        </button>
        <button
          className="packcard__btn packcard__btn--fiszki"
          onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/fiszki-start`) }}
        >
          <span>⚡</span> Trenuj
        </button>
      </div>
    </div>
  )
}
