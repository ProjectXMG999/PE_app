import { motion, useReducedMotion } from 'framer-motion'
import { packLevelThresholds } from '../../data/nextPack'
import { EASE_OUT_EXPO } from './motion'
import { PackMeta } from '../../types/vocabulary'
import './ListenStrip.css'

interface Props {
  listenedPacks: number
  totalPacks: number
  packs: PackMeta[]
}

/**
 * The Słuchaj counterpart to RouteStrip — same card/gradient/marker quality,
 * packs instead of words (Słuchaj doesn't track per-word mastery the way
 * Trenuj does), with its own "stations" from `packLevelThresholds` so this
 * track reads as a route too, not just a generic loading bar.
 */
export function ListenStrip({ listenedPacks, totalPacks, packs }: Props) {
  const reduced = useReducedMotion()
  const pct = totalPacks > 0 ? Math.min(100, (listenedPacks / totalPacks) * 100) : 0
  const thresholds = packLevelThresholds(packs)
  const ticks = thresholds.slice(0, 3) // drop the final one — the strip's own end is the finish line

  return (
    <div className="listenstrip">
      <p className="listenstrip__eyebrow">🎧 Twój <span className="listenstrip__eyebrow-highlight">progress</span> słuchania</p>

      <div className="listenstrip__figure">
        <span className="listenstrip__value">{listenedPacks.toLocaleString('pl-PL')}</span>
        <span className="listenstrip__unit">paczek</span>
        <span className="listenstrip__of">/ {totalPacks.toLocaleString('pl-PL')}</span>
        <span className="listenstrip__pct">{Math.round(pct)}%</span>
      </div>

      <div className="listenstrip__track">
        <motion.div
          className="listenstrip__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_EXPO }}
        />
        {ticks.map((t, i) => (
          <span
            key={i}
            className={`listenstrip__tick${listenedPacks >= t ? ' listenstrip__tick--passed' : ''}`}
            style={{ left: `${(t / totalPacks) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <span
          className="listenstrip__marker"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
