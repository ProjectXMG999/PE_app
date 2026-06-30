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
}

export function PackageCard({ pack, progress }: Props) {
  const navigate = useNavigate()
  const icon = CATEGORY_ICONS[pack.category] ?? CATEGORY_ICONS.default
  const color = CATEGORY_COLORS[pack.category] ?? CATEGORY_COLORS.default
  const progressPct = progress ? (progress.currentIndex / pack.wordCount) * 100 : 0
  const isCompleted = progress?.completedAt != null

  return (
    <div className="packcard">
      <div className="packcard__header">
        <div className="packcard__icon" style={{ background: `${color}22`, color }}>
          {icon}
        </div>
        <div className="packcard__info">
          <h3 className="packcard__name">{pack.name}</h3>
          <span className="packcard__meta">{pack.volume} · {pack.category}</span>
        </div>
        <div className="packcard__right">
          {isCompleted && (
            <span className="packcard__badge packcard__badge--done">✓</span>
          )}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <div className="packcard__progress-row">
        <span className="packcard__count">
          {progress?.currentIndex ?? 0} / {pack.wordCount} słów
        </span>
        {pack.level && (
          <span className="packcard__level">Poziom {pack.level}</span>
        )}
      </div>

      {progressPct > 0 && (
        <div className="packcard__progressbar">
          <div className="packcard__progressbar-fill" style={{ width: `${progressPct}%`, background: color }} />
        </div>
      )}

      <div className="packcard__actions">
        <button
          className="packcard__btn packcard__btn--autoplay"
          onClick={() => navigate(`/pakiet/${pack.id}/autoplay`)}
        >
          <span>🚗</span> Auto-play
        </button>
        <button
          className="packcard__btn packcard__btn--fiszki"
          onClick={() => navigate(`/pakiet/${pack.id}/fiszki`)}
        >
          <span>🃏</span> Fiszki
        </button>
      </div>
    </div>
  )
}
