import { useState } from 'react'
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
  'Wulgaryzmy': '🤬',
  'default': '📚',
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#eab308',
  2: '#f97316',
  3: '#22c55e',
  4: '#3b82f6',
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

const MODE_INFO = {
  sluchaj: 'Tryb audio do osłuchania, powtórki i nauki w tle. Uczysz się słów bez patrzenia w ekran. Idealne w aucie, na spacerze, na siłowni, w poczekalni albo w metrze.',
  aktywuj: 'Tryb głębokiego treningu słowa. Przypominasz sobie znaczenie, mówisz na głos i budujesz własne frazy lub zdania. Tutaj słowo przestaje być tylko znane — zaczynasz czuć, że potrafisz go użyć w prawdziwej rozmowie.',
}

const INFO_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
  </svg>
)

export function PackageCard({ pack, progress, knownCount = 0 }: Props) {
  const navigate = useNavigate()
  const [activeInfo, setActiveInfo] = useState<'sluchaj' | 'aktywuj' | null>(null)
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

      <div className="packcard__header">
        {packNum && (
          <div className="packcard__num">
            <span
              className="packcard__num-text"
              style={{ color: pack.level ? LEVEL_COLORS[pack.level] : undefined }}
            >
              #{packNum}
            </span>
          </div>
        )}
        <div className="packcard__icon" style={{ background: `${color}22`, color }}>
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

      {activeInfo && (
        <div className="packcard__mode-info">
          <span className="packcard__mode-info-icon">{activeInfo === 'sluchaj' ? '🎧' : '⚡'}</span>
          <div>
            <p className="packcard__mode-info-title">{activeInfo === 'sluchaj' ? 'Słuchaj' : 'Aktywuj'}</p>
            <p className="packcard__mode-info-desc">{MODE_INFO[activeInfo]}</p>
          </div>
        </div>
      )}
      <div className="packcard__actions">
        <div className="packcard__btn-wrap">
          <button
            className="packcard__btn packcard__btn--autoplay"
            onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/start`) }}
          >
            <span>🎧</span> Słuchaj
          </button>
          <button
            className={`packcard__info-btn${activeInfo === 'sluchaj' ? ' packcard__info-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveInfo(v => v === 'sluchaj' ? null : 'sluchaj') }}
            aria-label="Informacje o trybie Słuchaj"
          >
            {INFO_ICON}
          </button>
        </div>
        <div className="packcard__btn-wrap">
          <button
            className="packcard__btn packcard__btn--fiszki"
            onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/fiszki-start`) }}
          >
            <span>⚡</span> Aktywuj
          </button>
          <button
            className={`packcard__info-btn packcard__info-btn--dark${activeInfo === 'aktywuj' ? ' packcard__info-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveInfo(v => v === 'aktywuj' ? null : 'aktywuj') }}
            aria-label="Informacje o trybie Aktywuj"
          >
            {INFO_ICON}
          </button>
        </div>
      </div>
    </div>
  )
}
