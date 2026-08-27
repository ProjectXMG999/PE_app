import { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import { useAuthStore } from '../../store/useAuthStore'
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
  const { user, hasAccess: hasAccessFn } = useAuthStore()
  const hasAccess = hasAccessFn()
  // Mirror RequireEntitlement's redirect logic: logged-out visitors go to
  // login first, logged-in-but-unentitled users go straight to the account page.
  const goToAccount = (e: MouseEvent) => { e.stopPropagation(); navigate(user ? '/konto' : '/logowanie') }
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
      onClick={hasAccess ? () => navigate(`/pakiet/${pack.id}`) : goToAccount}
      style={{ cursor: 'pointer' }}
    >
      {/* Status stripe — visible left border accent (gold border replaces it when mastered) */}
      {status !== 'new' && !isMastered && <div className="packcard__stripe" />}

      {!hasAccess && (
        <div className="packcard__lock" aria-label="Wymaga subskrypcji" title="Wymaga subskrypcji">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="4" y="11" width="16" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>
      )}

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
          onClick={hasAccess ? (e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/start`) } : goToAccount}
        >
          <span>🎧</span> Słuchaj
        </button>
        <button
          className="packcard__btn packcard__btn--fiszki"
          onClick={hasAccess ? (e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/fiszki-start`) } : goToAccount}
        >
          <span>⚡</span> Trenuj
        </button>
      </div>
    </div>
  )
}
