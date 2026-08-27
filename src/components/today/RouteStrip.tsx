import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_META, ROUTE_TOTAL } from '../../data/levels'
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

  // Level thresholds as marks along the strip, excluding the final one (the
  // strip's own end already reads as the finish line).
  const ticks = LEVEL_META.filter(l => l.threshold < ROUTE_TOTAL)

  return (
    <div className="routestrip">
      <p className="routestrip__eyebrow">⚡ Twój <span className="routestrip__eyebrow-highlight">progress</span> treningu</p>

      <div className="routestrip__figure">
        <span className="routestrip__value">{knownWords.toLocaleString('pl-PL')}</span>
        <span className="routestrip__unit">słów</span>
        <span className="routestrip__of">/ {ROUTE_TOTAL.toLocaleString('pl-PL')}</span>
        <span className="routestrip__pct">{Math.round(pct)}%</span>
      </div>

      <div className="routestrip__track">
        <motion.div
          className="routestrip__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_EXPO }}
        />
        {ticks.map(l => (
          <span
            key={l.level}
            className={`routestrip__tick${knownWords >= l.threshold ? ' routestrip__tick--passed' : ''}`}
            style={{ left: `${(l.threshold / ROUTE_TOTAL) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <span
          className="routestrip__marker"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
