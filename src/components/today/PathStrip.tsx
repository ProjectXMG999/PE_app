import { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE_OUT_EXPO } from './motion'
import './PathStrip.css'

/** A mark along the track — a level threshold, in the same unit as `value`. */
export interface StripTick {
  at: number
}

/** The band you're standing in, named and in its own colour. */
export interface StripBand {
  label: string
  color?: string
  /** What's next and how far — omitted at the end of the route. */
  next?: { label: string; remaining: number }
}

interface Props {
  /** The label above the figure, e.g. <><BoltGlyph /> Twój <em>progress</em> treningu</>. */
  eyebrow: ReactNode
  value: number
  total: number
  /** Noun for `value` in the genitive plural: "słów", "paczek". */
  unit: string
  ticks: StripTick[]
  band?: StripBand
}

/**
 * Where you stand on a whole path, as one glance — "where am I on the journey"
 * before the card below asks "what do I do now". Its own card above the path's
 * recommendation.
 *
 * The percentage is the hero figure; the count is its caption; the ticks on the
 * bar are the level thresholds, so the bar is a scale you can read. The only
 * motion is the fill growing once.
 *
 * ── Two colours, two jobs ──────────────────────────────────────────────────
 * --path-accent says WHICH path this is: blue under Słuchaj, violet under
 * Trenuj, set by the ModeSlider this card sits inside. It lights the glass and
 * the eyebrow.
 *
 * --band-color says HOW FAR along it you are: the reached level's own colour
 * from LEVEL_COLORS — the same yellow / orange / green / blue the Trening
 * exercises are drawn in. It fills the bar and the chip, so climbing a level
 * visibly recolours the thing that measures the climb.
 *
 * The band arrives already computed; until now only its `next` half was ever
 * drawn and the colour was thrown away.
 */
export function PathStrip({ eyebrow, value, total, unit, ticks, band }: Props) {
  const reduced = useReducedMotion()
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  const shownPct = Math.round(pct)

  return (
    <div
      className="pathstrip u-liquid u-liquid--tint"
      style={band?.color ? ({ ['--band-color' as string]: band.color } as CSSProperties) : undefined}
    >
      <div className="pathstrip__head">
        <p className="pathstrip__eyebrow u-kicker">{eyebrow}</p>
        {band && (
          <span className="pathstrip__band">
            {band.label}
          </span>
        )}
      </div>

      <div className="pathstrip__figure">
        <span className="pathstrip__pct">{shownPct}%</span>
        <span className="pathstrip__caption">
          {value.toLocaleString('pl-PL')} / {total.toLocaleString('pl-PL')} {unit}
        </span>
      </div>

      <div
        className="pathstrip__track"
        role="img"
        aria-label={`${value} z ${total} ${unit}, ${shownPct}%`}
      >
        <motion.div
          className="pathstrip__fill"
          initial={{ width: reduced ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
        />
        {ticks.map(t => (
          <span
            key={t.at}
            className="pathstrip__tick"
            style={{ left: `${total > 0 ? (t.at / total) * 100 : 0}%` }}
            aria-hidden="true"
          />
        ))}
      </div>

      {band?.next && (
        <p className="pathstrip__next">
          do {band.next.label}: {band.next.remaining.toLocaleString('pl-PL')} {unit}
        </p>
      )}
    </div>
  )
}
