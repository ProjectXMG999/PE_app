import { Link } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import { useAuthStore } from '../../store/useAuthStore'
import { usePrefetchOnHover, loadPackPreview } from '../../hooks/usePrefetchOnHover'
import { routeNumber } from '../../utils/packRoute'
import {
  getPackIcon,
  getCategoryColor,
  getStatus,
  STATUS_META,
} from '../../utils/packVisuals'
import './PackageCard.css'

interface Props {
  pack: PackMeta
  progress?: PackageProgress
  knownCount?: number
  /** The earliest not-yet-mastered pack on the route — gets the "Kontynuuj" cue. */
  isFrontier?: boolean
}

/** One glyph standing in for the status pill — quieter on a long scroll. */
const STATUS_GLYPH: Record<string, { glyph: string; aria: string }> = {
  started:   { glyph: '◐', aria: 'W toku' },
  completed: { glyph: '✓', aria: 'Odsłuchana' },
  mastered:  { glyph: '★', aria: 'Opanowana' },
}

export function PackageCard({ pack, progress, knownCount = 0, isFrontier = false }: Props) {
  const { user, hasAccess: hasAccessFn } = useAuthStore()
  const hasAccess = hasAccessFn()
  const prefetch = usePrefetchOnHover(loadPackPreview)

  const icon = getPackIcon(pack)
  const color = getCategoryColor(pack.category)
  const num = routeNumber(pack.id)
  const heardPct = progress ? Math.min((progress.currentIndex / pack.wordCount) * 100, 100) : 0
  const knownPct = pack.wordCount > 0 ? Math.min((knownCount / pack.wordCount) * 100, 100) : 0

  // A stale masteredAt can outlive its known words (services/masteryRepair heals
  // it on boot) — don't show gold until the count really reaches the total.
  const rawStatus = getStatus(progress)
  const status = rawStatus === 'mastered' && knownCount < pack.wordCount
    ? (progress?.completedAt ? 'completed' : 'started')
    : rawStatus
  const isMastered = status === 'mastered'
  const glyph = STATUS_GLYPH[status]

  // Mirror RequireEntitlement: logged-out → login, entitled-less → account.
  const to = hasAccess ? `/pakiet/${pack.id}` : (user ? '/konto' : '/logowanie')
  const ariaLabel = `Pakiet #${num}: ${pack.name}. ${pack.category}. `
    + `${knownCount} z ${pack.wordCount} słów opanowanych`
    + (glyph ? `, ${glyph.aria.toLowerCase()}` : '')

  return (
    <Link
      to={to}
      viewTransition
      {...prefetch}
      className={`packcard ${STATUS_META[status].className} ${isFrontier ? 'packcard--frontier' : ''}`}
      style={{ ['--cat' as string]: color }}
      aria-label={ariaLabel}
      id={`pack-${pack.id}`}
    >
      {status === 'started' && !isMastered && <span className="packcard__stripe" aria-hidden="true" />}

      {!hasAccess && (
        <span className="packcard__lock" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      )}

      <div className="packcard__header">
        <span className="packcard__num">#{num}</span>
        <div
          className="packcard__icon-ring"
          style={{
            ['--known-pct' as string]: isMastered ? 100 : Math.round(knownPct),
            ['--ring' as string]: isMastered ? '#f2b619' : '#10B981',
          }}
        >
          {/* Paired with PackPreviewPage's hero icon/name so the card morphs
              into the preview instead of cutting to it — same recipe as the
              training card → detail transition (TrainingPage.tsx). */}
          <div
            className="packcard__icon"
            style={{
              ...(isMastered ? {} : { background: `${color}22`, color }),
              viewTransitionName: `pack-icon-${pack.id}`,
            }}
          >
            {icon}
          </div>
        </div>
        <div className="packcard__info">
          <h3 className="packcard__name" style={{ viewTransitionName: `pack-name-${pack.id}` }}>{pack.name}</h3>
          <span className="packcard__meta">{pack.category}</span>
        </div>
        <div className="packcard__right">
          {isFrontier && hasAccess && <span className="packcard__frontier-tag">Kontynuuj →</span>}
          {glyph && (
            <span className={`packcard__glyph packcard__glyph--${status}`} title={glyph.aria} aria-hidden="true">
              {glyph.glyph}
            </span>
          )}
          <span className="packcard__count">{knownCount}/{pack.wordCount}</span>
        </div>
      </div>

      {heardPct > 0 && !isMastered && (
        <span className="packcard__heard" aria-hidden="true">
          <span className="packcard__heard-fill" style={{ width: `${heardPct}%` }} />
        </span>
      )}
    </Link>
  )
}
