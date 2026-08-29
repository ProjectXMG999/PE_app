import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_META, ROUTE_TOTAL } from '../../data/levels'
import { useCountUp } from '../../hooks/useCountUp'
import { EASE_OUT_EXPO } from './motion'
import './RouteStrip.css'

interface Props {
  knownWords: number
}

/**
 * A mini, horizontal cut of the same 10 000-word route drawn in full on
 * src/components/progress/RouteMap.tsx (and on CompassHero on Postęp) —
 * "where am I on the whole journey" as one glance, before the page asks
 * "what do I do now". Reuses CompassHero's fill/marker recipe rather than a
 * flatter one-off, so the two screens read as the same route, not two.
 */
export function RouteStrip({ knownWords }: Props) {
  const reduced = useReducedMotion()
  const pct = Math.min(100, (knownWords / ROUTE_TOTAL) * 100)

  // Figure + percentage roll up in step with the fill bar (all 1.5s, after a
  // short hold so the roll isn't spent behind the route/data load).
  const shownWords = useCountUp(knownWords, 1500, 150)
  const shownPct = useCountUp(Math.round(pct), 1500, 150)

  // Level thresholds as marks along the strip, excluding the final one (the
  // strip's own end already reads as the finish line).
  const ticks = LEVEL_META.filter(l => l.threshold < ROUTE_TOTAL)

  return (
    <div className="routestrip">
      <p className="routestrip__eyebrow">⚡ Twój <span className="routestrip__eyebrow-highlight">progress</span> treningu</p>

      <div className="routestrip__figure">
        <span key={knownWords} className="routestrip__value">{shownWords.toLocaleString('pl-PL')}</span>
        <span className="routestrip__unit">słów</span>
        <span className="routestrip__of">/ {ROUTE_TOTAL.toLocaleString('pl-PL')}</span>
        <span className="routestrip__pct">{shownPct}%</span>
      </div>

      <div className="routestrip__track">
        <motion.div
          className="routestrip__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 1.5, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
        />
        {ticks.map(l => (
          <span
            key={l.level}
            className={`routestrip__tick${knownWords >= l.threshold ? ' routestrip__tick--passed' : ''}`}
            style={{ left: `${(l.threshold / ROUTE_TOTAL) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {/* Rides the growing fill (same timing/ease) instead of teleporting to
            the end; a comet trail sits behind it and a glow ring on ::after
            fires as it settles. */}
        <motion.span
          className="routestrip__marker"
          initial={{ left: 0 }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 1.5, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
