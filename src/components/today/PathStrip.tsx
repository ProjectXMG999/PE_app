import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
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
  /** 'train' runs the four level colours along the fill; 'listen' is one hue. */
  tone: 'train' | 'listen'
  /** The eyebrow, e.g. <>⚡ Twój <em>progress</em> treningu</> — see TodayPage. */
  eyebrow: ReactNode
  value: number
  total: number
  /** Plural noun for `value`: "słów", "paczek". */
  unit: string
  ticks: StripTick[]
  band?: StripBand
}

/**
 * Where you stand on a whole path, as one glance — "where am I on the journey"
 * before the page asks "what do I do now".
 *
 * One component for both paths. Trenuj and Słuchaj ran two near-identical
 * copies of this (RouteStrip / ListenStrip, ~200 lines of CSS apiece) which had
 * already drifted apart: a fix to one never reached the other. Everything that
 * genuinely differs is a prop — the colour, the noun, and what the ticks mean.
 *
 * The bar is a scale, not decoration: the ticks are level thresholds. The
 * percentage is the one number this card exists to answer, so it's the hero
 * figure; the word/pack count is a supporting caption on the same line rather
 * than its own 24px readout, and the band pill is gone (the level name is
 * already on screen in LevelPill above — this used to say it twice).
 */
export function PathStrip({ tone, eyebrow, value, total, unit, ticks, band }: Props) {
  const reduced = useReducedMotion()
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0

  // Figure and percentage roll up in step with the fill (all 1.5s, after a
  // short hold so the roll isn't spent behind the route/data load).
  const shownValue = useCountUp(value, 1500, 150)
  const shownPct = useCountUp(Math.round(pct), 1500, 150)

  return (
    <div className={`pathstrip pathstrip--${tone} u-surface--stat`}>
      <p className="pathstrip__eyebrow u-kicker">{eyebrow}</p>

      <div className="pathstrip__figure">
        <span className="pathstrip__pct">{shownPct}%</span>
        <span key={value} className="pathstrip__caption">
          {shownValue.toLocaleString('pl-PL')} / {total.toLocaleString('pl-PL')} {unit}
        </span>
      </div>

      <div
        className="pathstrip__track"
        role="img"
        aria-label={`${value} z ${total} ${unit} — ${Math.round(pct)}%`}
      >
        <motion.div
          className="pathstrip__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 1.5, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
        />
        {ticks.map(t => (
          <span
            key={t.at}
            className={`pathstrip__tick${value >= t.at ? ' pathstrip__tick--passed' : ''}`}
            style={{ left: `${total > 0 ? (t.at / total) * 100 : 0}%` }}
            aria-hidden="true"
          />
        ))}
        {/* Rides the growing fill (same timing/ease) instead of teleporting to
            the end; a comet trail sits behind it and a ring on ::after fires as
            it settles. Both play once. */}
        <motion.span
          className="pathstrip__marker"
          initial={{ left: 0 }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 1.5, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
          aria-hidden="true"
        />
      </div>

      {band?.next && (
        <p className="pathstrip__scale">
          <span className="pathstrip__next">
            do {band.next.label}: {band.next.remaining.toLocaleString('pl-PL')} {unit}
          </span>
        </p>
      )}
    </div>
  )
}
