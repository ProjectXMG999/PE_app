import { useState } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import { LEVEL_META, ROUTE_TOTAL } from '../../data/levels'
import { formatPoints } from '../../services/points'
import { MetricsInfoSheet } from './MetricsInfoSheet'
import './CompassHero.css'

interface Props {
  knownWords: number
  streak: number
  points: number
  /** Words per day, with an optional week-over-week delta. */
  pace: { current: number; deltaPct: number | null } | null
  /** Sentence in the navigation voice: what this means for what's next. */
  guidance: string
  loading?: boolean
}

/**
 * The instrument panel: where you are, how fast you're moving, and — the part
 * that matters — what that means for what's next.
 *
 * The full 0→10 000 route is drawn as one thin line with the four milestones
 * notched onto it, so the number always arrives with its scale attached. The
 * aurora behind the marker is positioned from the same percentage, which makes
 * the page literally brighten at the point you've reached.
 */
export function CompassHero({ knownWords, streak, points, pace, guidance, loading }: Props) {
  const animated = useCountUp(loading ? 0 : knownWords)
  const pct = Math.min(100, (knownWords / ROUTE_TOTAL) * 100)
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <section
      className="compass"
      style={{ ['--you-pct' as string]: `${pct}%` }}
      aria-label="Twoja trasa"
    >
      <div className="compass__aurora" aria-hidden="true" />

      {/* Explains seria / punkty / tempo below — the three numbers a new user
          has no way to reverse-engineer on their own. */}
      <button
        type="button"
        className="compass__info-btn"
        onClick={() => setInfoOpen(true)}
        aria-label="Jak liczymy serię, punkty i tempo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <p className="compass__eyebrow">Twoja trasa</p>

      <p className="compass__figure">
        <span className="compass__value">{animated.toLocaleString('pl-PL')}</span>
        <span className="compass__total">/ {ROUTE_TOTAL.toLocaleString('pl-PL')}</span>
      </p>
      <p className="compass__unit">słów poznanych</p>

      <div className="compass__track" role="img" aria-label={`${knownWords} z ${ROUTE_TOTAL} słów`}>
        <div className="compass__fill" style={{ width: `${pct}%` }} />
        {LEVEL_META.map(l => (
          <span
            key={l.level}
            className={`compass__notch${knownWords >= l.threshold ? ' compass__notch--passed' : ''}`}
            style={{ left: `${(l.threshold / ROUTE_TOTAL) * 100}%` }}
            title={`${l.name} — ${l.threshold.toLocaleString('pl-PL')}`}
          />
        ))}
        <span className="compass__marker" style={{ left: `${pct}%` }} aria-hidden="true" />
      </div>

      <dl className="compass__gauges">
        <div className="compass__gauge">
          <dt className="compass__gauge-label">seria</dt>
          <dd className="compass__gauge-value">
            <span className="compass__gauge-icon" aria-hidden="true">🔥</span>
            {streak}
            <span className="compass__gauge-suffix">dni</span>
          </dd>
        </div>
        <div className="compass__gauge">
          <dt className="compass__gauge-label">punkty</dt>
          <dd className="compass__gauge-value compass__gauge-value--points">
            <span className="compass__gauge-icon" aria-hidden="true">⬥</span>
            {formatPoints(points)}
          </dd>
        </div>
        <div className="compass__gauge">
          <dt className="compass__gauge-label">tempo</dt>
          <dd className="compass__gauge-value">
            <span className="compass__gauge-icon" aria-hidden="true">⚡</span>
            {pace?.current ?? 0}
            <span className="compass__gauge-suffix">/dzień</span>
            {pace?.deltaPct != null && (
              <span className={`compass__delta${pace.deltaPct >= 0 ? '' : ' compass__delta--down'}`}>
                {pace.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(pace.deltaPct)}%
              </span>
            )}
          </dd>
        </div>
      </dl>

      <p className="compass__guidance">{guidance}</p>

      {infoOpen && <MetricsInfoSheet onClose={() => setInfoOpen(false)} />}
    </section>
  )
}
