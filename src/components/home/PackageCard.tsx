import { Link } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import { useAuthStore } from '../../store/useAuthStore'
import { usePrefetchOnHover, loadPackPreview } from '../../hooks/usePrefetchOnHover'
import { routeNumber } from '../../utils/packRoute'
import { PackMemory } from '../../utils/packMemory'
import { usePackWords } from '../../hooks/usePackWords'
import { LEVEL_COLORS, getStatus, STATUS_META } from '../../utils/packVisuals'
import './PackageCard.css'

interface Props {
  pack: PackMeta
  progress?: PackageProgress
  knownCount?: number
  /** The earliest not-yet-mastered pack on the route — gets the "Dalej" cue. */
  isFrontier?: boolean
  /** Your relationship with this pack (held / fading / active / ahead). */
  memory?: PackMemory
}

/** One glyph standing in for the status pill — quieter on a long scroll. */
const STATUS_GLYPH: Record<string, { glyph: string; aria: string }> = {
  started:   { glyph: '◐', aria: 'W toku' },
  completed: { glyph: '✓', aria: 'Odsłuchana' },
  mastered:  { glyph: '★', aria: 'Opanowana' },
}

export function PackageCard({ pack, progress, knownCount = 0, isFrontier = false, memory }: Props) {
  const { user, hasAccess: hasAccessFn } = useAuthStore()
  const hasAccess = hasAccessFn()
  const prefetch = usePrefetchOnHover(loadPackPreview)
  const words = usePackWords(pack.id)

  const num = routeNumber(pack.id)
  const levelColor = LEVEL_COLORS[pack.level] ?? 'var(--accent)'
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
  const fading = memory?.relation === 'fading'

  // Mirror RequireEntitlement: logged-out → login, entitled-less → account.
  const to = hasAccess ? `/pakiet/${pack.id}` : (user ? '/konto' : '/logowanie')
  const ariaLabel = `Pakiet #${num}: ${pack.name}. ${pack.category}. `
    + `${knownCount} z ${pack.wordCount} słów opanowanych`
    + (glyph ? `, ${glyph.aria.toLowerCase()}` : '')
    + (fading ? ', wraca do powtórki' : '')

  return (
    <Link
      to={to}
      viewTransition
      {...prefetch}
      className={`packcard ${STATUS_META[status].className} ${isFrontier ? 'packcard--frontier' : ''}${fading ? ' packcard--fading' : ''}`}
      style={{ ['--lvl' as string]: levelColor }}
      aria-label={ariaLabel}
      id={`pack-${pack.id}`}
    >
      {/* State as a full-height edge, not a 12px glyph. Reading a long list
          should not require inspecting each row. */}
      <span className="packcard__edge" aria-hidden="true" />

      {/* The route number IS the pack's identity — the whole product thesis is
          that position in the order is what matters. An emoji said nothing about
          which of 864 packs this is; #317 says exactly that. */}
      <span
        className="packcard__mark"
        style={{
          ['--known-pct' as string]: isMastered ? 100 : Math.round(knownPct),
          ['--ring' as string]: isMastered ? '#f2b619' : '#10B981',
        }}
      >
        <span className={`packcard__mark-num${num >= 100 ? ' is-wide' : ''}`}>{num}</span>
      </span>

      <span className="packcard__body">
        <span className="packcard__name">{pack.name}</span>
        {/* A vocabulary app that shows no vocabulary was the biggest information
            loss on this page. Locked visitors see the same words out of focus —
            a sample of what they're buying rather than a padlock over the pack.
            The small lock sits on the *content* line so the blur reads as a
            deliberate teaser; without it 864 blurred lines look like a
            rendering fault. */}
        {words && !hasAccess ? (
          <span className="packcard__sub packcard__sub--locked">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <em>{words.join(' · ')}</em>
          </span>
        ) : (
          <span className="packcard__sub">{words ? words.join(' · ') : pack.category}</span>
        )}
      </span>

      <span className="packcard__tail">
        {isFrontier && hasAccess && <span className="packcard__go">Dalej →</span>}
        <span className="packcard__count">
          <b>{knownCount}</b>/{pack.wordCount}
        </span>
        <span className="packcard__state">
          {/* Fading sits next to — never instead of — the earned glyph. */}
          {fading && <span className="packcard__fade-dot" title="Wraca do powtórki" aria-hidden="true" />}
          {glyph && (
            <span className={`packcard__glyph packcard__glyph--${status}`} title={glyph.aria} aria-hidden="true">
              {glyph.glyph}
            </span>
          )}
        </span>
      </span>

      {heardPct > 0 && !isMastered && (
        <span className="packcard__heard" aria-hidden="true">
          <span className="packcard__heard-fill" style={{ width: `${heardPct}%` }} />
        </span>
      )}
    </Link>
  )
}
