import { useNavigate } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import './PackageCard.css'

const CATEGORY_ICONS: Record<string, string> = {
  'Rzeczowniki': '📦',
  'Czasowniki': '⚡',
  'Przymiotniki': '🎨',
  'Przysłówki': '🔄',
  'Phrasale': '🔗',
  'Slang': '💬',
  'default': '📚',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Rzeczowniki': '#8B5CF6',
  'Czasowniki': '#F59E0B',
  'Przymiotniki': '#10B981',
  'Przysłówki': '#3B82F6',
  'Phrasale': '#EC4899',
  'Slang': '#EF4444',
  'default': '#6B7280',
}

interface Props {
  pack: PackMeta
  progress?: PackageProgress
  knownCount?: number
}

function getPackNumber(id: string): string | null {
  const match = id.match(/p0*(\d+)$/)
  return match ? match[1] : null
}

type PackStatus = 'new' | 'started' | 'completed' | 'mastered'

function getStatus(progress: PackageProgress | undefined): PackStatus {
  if (!progress) return 'new'
  if (progress.masteredAt) return 'mastered'
  if (progress.completedAt) return 'completed'
  return 'started'
}

const STATUS_META: Record<PackStatus, { label: string; className: string }> = {
  new:       { label: '',              className: '' },
  started:   { label: 'W toku',        className: 'packcard--started' },
  completed: { label: '✓ Odsłuchana',  className: 'packcard--completed' },
  mastered:  { label: '★ Opanowana',   className: 'packcard--mastered' },
}

export function PackageCard({ pack, progress, knownCount = 0 }: Props) {
  const navigate = useNavigate()
  const icon = CATEGORY_ICONS[pack.category] ?? CATEGORY_ICONS.default
  const color = CATEGORY_COLORS[pack.category] ?? CATEGORY_COLORS.default
  const heardPct = progress ? Math.min((progress.currentIndex / pack.wordCount) * 100, 100) : 0
  const knownPct = pack.wordCount > 0 ? Math.min((knownCount / pack.wordCount) * 100, 100) : 0
  const status = getStatus(progress)
  const { label: statusLabel, className: statusClass } = STATUS_META[status]
  const packNum = getPackNumber(pack.id)

  return (
    <div
      className={`packcard ${statusClass}`}
      onClick={() => navigate(`/pakiet/${pack.id}`)}
      style={{ cursor: 'pointer' }}
    >
      {/* Status stripe — visible left border accent */}
      {status !== 'new' && <div className="packcard__stripe" />}

      {packNum && <span className="packcard__num-badge">#{packNum}</span>}

      <div className="packcard__header">
        <div className="packcard__icon" style={{ background: `${color}22`, color }}>
          {icon}
        </div>
        <div className="packcard__info">
          <h3 className="packcard__name">{pack.name}</h3>
          <span className="packcard__meta">{pack.volume} · {pack.category}</span>
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
          <span>⚡</span> Aktywuj
        </button>
      </div>
    </div>
  )
}
