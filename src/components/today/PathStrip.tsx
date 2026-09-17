import { ReactNode } from 'react'
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
 * bar are the level thresholds, so the bar is a scale you can read. One tint
 * for both paths, and the only motion is the fill growing once.
 */
export function PathStrip({ eyebrow, value, total, unit, ticks, band }: Props) {
  const reduced = useReducedMotion()
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  const shownPct = Math.round(pct)

  return (
    <div className="pathstrip u-liquid">
      <p className="pathstrip__eyebrow u-kicker">{eyebrow}</p>

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
