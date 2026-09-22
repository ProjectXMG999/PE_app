import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { FlowNumber } from '../shared/FlowNumber'
import { BoltGlyph, FlameGlyph, GemGlyph } from '../mode/glyphs'
import { LEVEL_META, ROUTE_TOTAL } from '../../data/levels'
import { plWords, plDays } from '../../utils/plural'
import { MetricsInfoSheet } from './MetricsInfoSheet'
import './CompassHero.css'

interface Props {
  knownWords: number
  streak: number
  points: number
  /** Words LEARNED per day (avgWordsPerDay — the same figure the "przy tym
   *  tempie…" sentence divides by), with an optional week-over-week delta in
   *  throughput. */
  pace: { current: number; deltaPct: number | null } | null
  /** Sentence in the navigation voice: what this means for what's next. */
  guidance: string
  loading?: boolean
}

/** How long the line takes to draw itself. Must match the `transition`
 *  durations on .compass__fill / __marker / __aurora. */
const SWEEP_MS = 900

/**
 * The panel powers up instead of appearing switched on.
 *
 * Everything here — the fill width, the marker, the aurora — already had a
 * 900ms transition, and the marker's idle pulse was even written to start after
 * it. None of it ever ran: a CSS transition needs two values, and the hero
 * mounts once, with the final one. So the whole instrument renders at zero and
 * is handed its real values one paint later; from there the existing
 * transitions do exactly what they were written to do.
 *
 * Two frames, not one: the zeroed state has to be committed *and* painted, or
 * the browser coalesces both values into the same style change and there is
 * nothing to interpolate between.
 */
function useSweep(): boolean {
  const reduced = useReducedMotion()
  const [swept, setSwept] = useState(!!reduced)

  useEffect(() => {
    if (swept) return
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setSwept(true)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [swept])

  return swept
}

/**
 * When the leading edge of the fill passes a point `frac` of the way along its
 * own final width — so a milestone lights up as the line reaches it rather than
 * all four lighting at once.
 *
 * An approximation of the inverse of --ease-out-expo, which is a cubic-bézier
 * and has no closed-form inverse worth carrying for this. The cube root has the
 * property that matters: like the real curve it spends most of its time on the
 * last stretch, so an early milestone lights early (half way ≈ 190ms of 900).
 */
function notchDelay(frac: number): number {
  if (!(frac > 0)) return 0
  if (frac >= 1) return SWEEP_MS
  return Math.round(SWEEP_MS * (1 - Math.cbrt(1 - frac)))
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
  const pct = Math.min(100, (knownWords / ROUTE_TOTAL) * 100)
  const swept = useSweep()
  // What the line is currently drawn to. The figures roll on their own clocks
  // (FlowNumber's delayMs below), staggered to land with the line rather than
  // all at once — the panel reads as one instrument coming up, left to right.
  const drawn = swept ? pct : 0
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <section
      className="compass u-surface--raised"
      style={{ ['--you-pct' as string]: `${drawn}%` }}
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

      {/* `useGrouping` explicitly, because pl-PL's default is `min2`: it groups
          from five digits up, so the panel read "2437 / 10 000" — the same
          quantity written two ways, side by side, in its largest type. */}
      <p className="compass__figure">
        <span className="compass__value">
          <FlowNumber value={loading ? 0 : knownWords} delayMs={60} format={{ useGrouping: true }} />
        </span>
        <span className="compass__total">/ {ROUTE_TOTAL.toLocaleString('pl-PL')}</span>
      </p>
      <p className="compass__unit">słów poznanych</p>

      <div className="compass__track" role="img" aria-label={`${knownWords} z ${ROUTE_TOTAL} ${plWords(ROUTE_TOTAL)}`}>
        <div className="compass__fill" style={{ width: `${drawn}%` }} />
        {LEVEL_META.map(l => {
          const at = (l.threshold / ROUTE_TOTAL) * 100
          const passed = knownWords >= l.threshold
          return (
            <span
              key={l.level}
              // Lit only once the line has been drawn — and then only when the
              // line actually reaches it. Reading `passed` straight off the data
              // would have all four already lit on the first frame, under a fill
              // still sitting at zero width.
              className={`compass__notch${swept && passed ? ' compass__notch--passed' : ''}`}
              style={{
                left: `${at}%`,
                transitionDelay: passed && pct > 0 ? `${notchDelay(at / pct)}ms` : '0ms',
              }}
              title={`${l.name} — ${l.threshold.toLocaleString('pl-PL')}`}
            />
          )
        })}
        <span className="compass__marker" style={{ left: `${drawn}%` }} aria-hidden="true" />
      </div>

      <dl className="compass__gauges">
        {/* The three figures roll in sequence behind the big one (60ms), so the
            eye is led down the panel instead of being handed everything at
            once. formatPoints is gone from here on purpose: FlowNumber's own
            pl-PL grouping is the same string, and a pre-formatted one can't
            roll. */}
        <div className="compass__gauge">
          <dt className="compass__gauge-label">seria</dt>
          <dd className="compass__gauge-value">
            <span className="compass__gauge-icon compass__gauge-icon--streak">
              <FlameGlyph size={15} weight={1.9} />
            </span>
            <FlowNumber value={streak} delayMs={140} />
            <span className="compass__gauge-suffix">{plDays(streak)}</span>
          </dd>
        </div>
        <div className="compass__gauge">
          <dt className="compass__gauge-label">punkty</dt>
          <dd className="compass__gauge-value compass__gauge-value--points">
            <span className="compass__gauge-icon compass__gauge-icon--points">
              <GemGlyph size={14} weight={1.9} />
            </span>
            <FlowNumber value={points} delayMs={200} format={{ useGrouping: true }} />
          </dd>
        </div>
        <div className="compass__gauge">
          {/* The delta rides on the LABEL, not on the figure. Beside the value
              it was a fourth item in a row already carrying an icon, a number
              and a unit: it wrapped, and the tempo column came out a line
              taller than the two beside it — three gauges that are meant to
              read as one instrument, sitting at two different heights. On the
              label line it also says what it is about, which is the metric
              rather than today's number. */}
          <dt className="compass__gauge-label">
            tempo
            {pace?.deltaPct != null && (
              <span className={`compass__delta${pace.deltaPct >= 0 ? '' : ' compass__delta--down'}`}>
                {pace.deltaPct >= 0 ? '↑' : '↓'}{Math.abs(pace.deltaPct)}%
              </span>
            )}
          </dt>
          <dd className="compass__gauge-value">
            <span className="compass__gauge-icon compass__gauge-icon--pace">
              <BoltGlyph size={15} weight={1.9} />
            </span>
            <FlowNumber value={pace?.current ?? 0} delayMs={260} />
            <span className="compass__gauge-suffix">/dzień</span>
          </dd>
        </div>
      </dl>

      <p className="compass__guidance">{guidance}</p>

      {infoOpen && <MetricsInfoSheet onClose={() => setInfoOpen(false)} />}
    </section>
  )
}
